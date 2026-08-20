'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth';

/**
 * Story authoring actions — the M1 critical path.
 *
 * Two things happen on every save that are worth naming:
 *
 *   1. Section markers (":: The House Waits") are parsed out of the body
 *      into story_sections. Bookmarks, audio cue points and journal
 *      entries anchor to those sections rather than to a character
 *      offset, so a later copy-edit does not move a reader's saved place.
 *
 *   2. Reading time is computed, never typed. A number a person maintains
 *      by hand is a number that goes stale.
 */

const storySchema = z.object({
  title: z.string().trim().min(1, 'A story needs a title.').max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
    .max(120),
  subtitle: z.string().trim().max(300).optional().or(z.literal('')),
  excerpt: z.string().trim().max(600).optional().or(z.literal('')),
  bodyMdx: z.string().optional().or(z.literal('')),
  authorId: z.string().uuid().optional().or(z.literal('')),
  shelfId: z.string().uuid().optional().or(z.literal('')),
  access: z.enum(['free', 'premium']),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(320).optional().or(z.literal('')),
});

export type StoryActionResult = { error?: string; message?: string };

/** Average adult reading speed for narrative prose, rounded up. */
const WORDS_PER_MINUTE = 220;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Pull ":: Section Title" markers out of the body.
 * Returns them in document order with their character offsets.
 */
function parseSections(body: string) {
  const sections: {
    slug: string;
    title: string;
    position: number;
    char_start: number;
  }[] = [];

  const re = /^::\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  let position = 0;

  while ((match = re.exec(body)) !== null) {
    const title = match[1].trim();
    const slug =
      title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `section-${position + 1}`;

    sections.push({
      // Guard against two sections with the same title in one story.
      slug: sections.some((s) => s.slug === slug) ? `${slug}-${position + 1}` : slug,
      title,
      position,
      char_start: match.index,
    });
    position += 1;
  }

  return sections;
}

/** Log anything that changes published content or access. */
async function audit(
  actorId: string,
  actorEmail: string | null,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const h = await headers();
    const admin = createAdminClient();
    await admin.from('audit_log').insert({
      actor_id: actorId,
      actor_email: actorEmail,
      action,
      entity_type: 'story',
      entity_id: entityId,
      before,
      after,
      ip_address: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      user_agent: h.get('user-agent'),
    });
  } catch (e) {
    // Never let audit failure block the edit — but make it loud.
    console.error('[audit] story write not logged', e);
  }
}

export async function saveStory(
  _prev: StoryActionResult,
  formData: FormData,
): Promise<StoryActionResult> {
  const viewer = await requireStaff();

  const id = (formData.get('id') as string) || null;

  const parsed = storySchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    excerpt: formData.get('excerpt'),
    bodyMdx: formData.get('bodyMdx'),
    authorId: formData.get('authorId'),
    shelfId: formData.get('shelfId'),
    access: formData.get('access'),
    status: formData.get('status'),
    seoTitle: formData.get('seoTitle'),
    seoDescription: formData.get('seoDescription'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;
  const body = d.bodyMdx ?? '';
  const words = countWords(body);

  const supabase = await createClient();

  const row = {
    title: d.title,
    slug: d.slug,
    subtitle: d.subtitle || null,
    excerpt: d.excerpt || null,
    body_mdx: body || null,
    author_id: d.authorId || null,
    access: d.access,
    status: d.status,
    word_count: words,
    reading_minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    seo_title: d.seoTitle || null,
    seo_description: d.seoDescription || null,
    // The schema refuses a published row without a date, so set one at
    // the moment of publication and leave it alone thereafter.
    published_at:
      d.status === 'published' ? new Date().toISOString() : null,
  };

  let storyId = id;
  let before: unknown = null;

  if (id) {
    const { data: existing } = await supabase
      .from('stories')
      .select('status, slug, access, published_at')
      .eq('id', id)
      .single();
    before = existing;

    // Preserve the original publication date across later edits.
    if (existing?.published_at && d.status === 'published') {
      row.published_at = existing.published_at;
    }

    const { error } = await supabase.from('stories').update(row).eq('id', id);
    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another story already uses that web address.'
            : error.message,
      };
    }
  } else {
    const { data, error } = await supabase
      .from('stories')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another story already uses that web address.'
            : error.message,
      };
    }
    storyId = data.id;
  }

  if (!storyId) return { error: 'The story could not be saved.' };

  // Rebuild sections from the body. Replace rather than diff: sections
  // carry no reader data of their own, and bookmarks reference them by
  // slug, which parseSections keeps stable for unchanged headings.
  const sections = parseSections(body);
  await supabase.from('story_sections').delete().eq('story_id', storyId);
  if (sections.length) {
    await supabase
      .from('story_sections')
      .insert(sections.map((s) => ({ ...s, story_id: storyId })));
  }

  // Primary shelf placement.
  if (d.shelfId) {
    await supabase.from('story_shelves').delete().eq('story_id', storyId);
    await supabase.from('story_shelves').insert({
      story_id: storyId,
      shelf_id: d.shelfId,
      is_primary: true,
    });
  }

  await audit(
    viewer.id,
    viewer.email,
    id ? 'story.update' : 'story.create',
    storyId,
    before,
    { status: d.status, slug: d.slug, access: d.access },
  );

  // Refresh the public pages this story appears on.
  revalidatePath('/library');
  revalidatePath(`/story/${d.slug}`);
  revalidatePath('/');

  redirect(`/admin/stories?saved=${encodeURIComponent(d.title)}`);
}

export async function deleteStory(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const id = formData.get('id') as string;
  if (!id) return;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('stories')
    .select('slug, title, status')
    .eq('id', id)
    .single();

  await supabase.from('stories').delete().eq('id', id);
  await audit(viewer.id, viewer.email, 'story.delete', id, before, null);

  revalidatePath('/library');
  revalidatePath('/admin/stories');
  redirect('/admin/stories?deleted=1');
}

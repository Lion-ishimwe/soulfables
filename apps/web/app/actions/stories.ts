'use server';

import type { Route } from 'next';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { after } from 'next/server';
import { ensureNarration } from '@/lib/audio/narrate';

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
  /*
   * Slugs, despite the names.
   *
   * These were typed as uuids and the form has always posted slugs — the
   * admin data layer speaks in slugs throughout, and the demo branch
   * below reads them as slugs too. The result was that every save in
   * live mode died here on "Invalid uuid" before touching the database,
   * while demo mode saved happily. Renaming the fields would mean
   * renaming them in the form, the draft type and both pages; accepting
   * what is actually sent and resolving it below is the smaller and more
   * honest change.
   */
  authorId: z.string().trim().max(120).optional().or(z.literal('')),
  shelfId: z.string().trim().max(120).optional().or(z.literal('')),
  access: z.enum(['free', 'premium', 'paid']),
  price: z.coerce.number().min(0).max(10000).catch(0),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']),
  coverImage: z.string().trim().max(600).optional().or(z.literal('')),
  releaseMode: z.enum(['full', 'serial']).catch('full'),
  seriesId: z.string().trim().max(120).optional().or(z.literal('')),
  episodeNumber: z.coerce.number().int().min(0).max(9999).catch(0),
  forSleep: z.boolean().default(false),
  seoTitle: z.string().trim().max(200).optional().or(z.literal('')),
  seoDescription: z.string().trim().max(320).optional().or(z.literal('')),
});

export type StoryActionResult = { error?: string; message?: string };

/*
 * Average adult reading speed for narrative prose, rounded up.
 *
 * The database is authoritative for this now: migration 0025 puts a
 * trigger on stories and story_chapters that derives word_count and
 * reading_minutes from the body, so whatever this file writes is
 * recomputed on the way in. The two agree deliberately — same 220, same
 * word count — so the value here is a correct prediction rather than a
 * competing one, and the form can preview an estimate as somebody types.
 *
 * The trigger exists because the seed set reading times by hand, at six
 * to eleven minutes for bodies of about 350 words, and the seed does not
 * run application code.
 */
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

/*
 * Auditing is not done here.
 *
 * This file used to carry an audit() helper that took an actor, a
 * before and an after, opened an admin client — and then inserted
 * nothing. It had been hollowed out and left behind, so every call site
 * read as "this edit is logged" while nothing was written, and its own
 * catch block promised to be loud about a failure that could not happen.
 *
 * Migration 0021 put an AFTER trigger on all 51 content tables, which
 * records stories.update, story_themes.insert and the rest with the real
 * actor. That is the audit trail, it works, and adding a second one here
 * would double-log every edit.
 */

export async function saveStory(
  _prev: StoryActionResult,
  formData: FormData,
): Promise<StoryActionResult> {
  const viewer = await requireStaff();

  const id = field(formData, 'id') || null;

  const parsed = storySchema.safeParse({
    title: field(formData, 'title'),
    slug: field(formData, 'slug'),
    subtitle: field(formData, 'subtitle'),
    excerpt: field(formData, 'excerpt'),
    bodyMdx: field(formData, 'bodyMdx'),
    authorId: field(formData, 'authorId'),
    shelfId: field(formData, 'shelfId'),
    access: field(formData, 'access'),
    price: field(formData, 'price') || '0',
    status: field(formData, 'status'),
    releaseMode: field(formData, 'releaseMode'),
    seriesId: field(formData, 'seriesId'),
    episodeNumber: field(formData, 'episodeNumber') || '0',
    forSleep: checkbox(formData, 'forSleep'),
    coverImage: field(formData, 'coverImage'),
    seoTitle: field(formData, 'seoTitle'),
    seoDescription: field(formData, 'seoDescription'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const d = parsed.data;

  /*
   * Themes come in as repeated checkbox values, which the single-value
   * schema above cannot express — so they are read and validated here.
   * Anything that is not a uuid is dropped rather than failing the save:
   * a malformed theme should not cost somebody their draft.
   */
  const themeIds = formData
    .getAll('themeIds')
    .map(String)
    .filter((v) => /^[0-9a-f-]{36}$/i.test(v));

  const body = d.bodyMdx ?? '';
  const words = countWords(body);

  // Demo mode writes to the editorial store, so the admin editor is not
  // a dead form when there is no database behind it.
  if (isDemoMode()) {
    const { demoGetStory, demoSaveStory } = await import('@/lib/demo/editorial');

    const existing = id ? demoGetStory(id) : null;
    const words = countWords(body);

    const result = demoSaveStory(id, {
      slug: d.slug,
      title: d.title,
      subtitle: d.subtitle || '',
      excerpt: d.excerpt || '',
      bodyMdx: body,
      authorSlug: d.authorId || null,
      assignedAuthorSlug: existing?.assignedAuthorSlug ?? (d.authorId || null),
      shelfSlug: d.shelfId || existing?.shelfSlug || 'heartbreak',
      access: d.access === 'paid' ? 'premium' : d.access,
      status:
        d.status === 'published'
          ? 'published'
          : d.status === 'in_review'
            ? 'in_review'
            : d.status === 'archived'
              ? 'archived'
              : 'draft',
      releaseMode: d.releaseMode,
      chapters: existing?.chapters ?? [],
      coverImage: d.coverImage || null,
      readingMinutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
      publishedAt:
        d.status === 'published'
          ? (existing?.publishedAt ?? new Date().toISOString())
          : null,
      submittedAt: existing?.submittedAt ?? null,
      submittedBy: existing?.submittedBy ?? null,
      approvedAt: existing?.approvedAt ?? null,
      revisionNote: existing?.revisionNote ?? null,
      hasAudio: existing?.hasAudio ?? false,
    });

    if (result.error) return { error: result.error };

    revalidatePath('/', 'layout');

    revalidateTag('content');
    redirect(`/admin/stories?saved=${encodeURIComponent(d.title)}` as Route);
  }

  const supabase = await createClient();

  /*
   * Slug in, id out.
   *
   * The form knows stories, authors and shelves by their web addresses;
   * the database joins them by id. Three small lookups turn one into the
   * other. They run together because none depends on the others.
   *
   * `id` is the slug the story had when the form was opened, not the one
   * in the slug field — that is the new address, and looking the story up
   * by it would miss the row whenever somebody renames a story.
   */
  const [storyRes, authorRes, shelfRes, seriesRes] = await Promise.all([
    id
      ? supabase.from('stories').select('id').eq('slug', id).maybeSingle()
      : Promise.resolve({ data: null }),
    d.authorId
      ? supabase.from('authors').select('id').eq('slug', d.authorId).maybeSingle()
      : Promise.resolve({ data: null }),
    d.shelfId
      ? supabase.from('shelves').select('id').eq('slug', d.shelfId).maybeSingle()
      : Promise.resolve({ data: null }),
    d.seriesId
      ? supabase.from('series').select('id').eq('slug', d.seriesId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const existingId = (storyRes.data as { id?: string } | null)?.id ?? null;
  const authorId = (authorRes.data as { id?: string } | null)?.id ?? null;
  const shelfId = (shelfRes.data as { id?: string } | null)?.id ?? null;
  const seriesId = (seriesRes.data as { id?: string } | null)?.id ?? null;

  if (id && !existingId) {
    return { error: 'That story no longer exists. It may have been deleted.' };
  }

  /*
   * Every published story lives on a shelf.
   *
   * The form offers "— none —", which is right for a draft that has not
   * found its place yet and wrong for anything readers are meant to
   * find: the library, the home page and the shelf pages all reach
   * stories through the shelf link, and a published story without one
   * was simply absent from all of them.
   */
  if (d.shelfId && !shelfId) {
    return { error: 'That shelf no longer exists. Choose another before saving.' };
  }
  if (d.access === 'paid' && !(d.price > 0)) {
    return { error: 'Set a price to sell it. Readers buy it from the Bookshop at that price.' };
  }
  if ((d.status === 'published' || d.status === 'scheduled') && !shelfId) {
    return { error: 'Choose a shelf before publishing. Readers find every story through its shelf.' };
  }

  const row = {
    title: d.title,
    slug: d.slug,
    subtitle: d.subtitle || null,
    excerpt: d.excerpt || null,
    body_mdx: body || null,
    author_id: authorId,
    access: d.access,
    status: d.status,
    word_count: words,
    reading_minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    cover_image: d.coverImage || null,
    series_id: seriesId,
    episode_number: seriesId && d.episodeNumber > 0 ? d.episodeNumber : null,
    for_sleep: d.forSleep,
    seo_title: d.seoTitle || null,
    seo_description: d.seoDescription || null,
    // The schema refuses a published row without a date, so set one at
    // the moment of publication and leave it alone thereafter.
    published_at:
      d.status === 'published' ? new Date().toISOString() : null,
  };

  let storyId = existingId;
  let before: unknown = null;

  if (existingId) {
    const { data: existing } = await supabase
      .from('stories')
      .select('status, slug, access, published_at, word_count')
      .eq('id', existingId)
      .single();
    before = existing;

    /*
     * Never blank a story by accident.
     *
     * An empty body arriving for a story that has one is almost always a
     * form that failed to load the prose rather than a writer deleting
     * it — that is exactly how the editor destroyed a story before
     * getWorkStory learned to fetch the body. word_count is used rather
     * than body_mdx because the column cannot be selected (0015), and it
     * answers the only question being asked.
     *
     * Deliberately emptying a story is still possible; it just has to go
     * through Delete, which asks first.
     */
    if (!body.trim() && Number(existing?.word_count ?? 0) > 0) {
      return {
        error:
          'The body came through empty for a story that has one. Nothing was saved — reload the page and try again.',
      };
    }

    // Preserve the original publication date across later edits.
    if (existing?.published_at && d.status === 'published') {
      row.published_at = existing.published_at;
    }

    const { error } = await supabase.from('stories').update(row).eq('id', existingId);
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

  // Published words are read aloud; unchanged words are not read twice.
  if (d.status === 'published') after(() => ensureNarration(d.slug, 'saved'));

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
  if (shelfId) {
    await supabase.from('story_shelves').delete().eq('story_id', storyId);
    await supabase.from('story_shelves').insert({
      story_id: storyId,
      shelf_id: shelfId,
      is_primary: true,
    });
  }

  // For sale: a book of it in the Bookshop, kept in step with the story.
  await syncStoryProduct(supabase, {
    storyId,
    slug: d.slug,
    title: d.title,
    subtitle: d.subtitle || null,
    excerpt: d.excerpt || null,
    coverImage: d.coverImage || null,
    authorId,
    shelfId,
    forSale: d.access === 'paid',
    price: d.price,
  });

  /*
   * Themes. Replaced wholesale, like sections — the join table carries
   * nothing of its own, so there is nothing to preserve by diffing.
   *
   * Unconditional, unlike the shelf above: clearing every theme is a
   * real edit, and skipping the write when the list is empty would make
   * removing the last one impossible.
   */
  await supabase.from('story_themes').delete().eq('story_id', storyId);
  if (themeIds.length) {
    await supabase
      .from('story_themes')
      .insert(themeIds.map((theme_id) => ({ story_id: storyId, theme_id })));
  }

  // Refresh the public pages this story appears on.
  revalidatePath('/library');
  revalidateTag('content');
  revalidatePath(`/story/${d.slug}`);
  revalidateTag('content');
  revalidatePath('/');
  revalidateTag('content');

  redirect(`/admin/stories?saved=${encodeURIComponent(d.title)}`);
}

export async function deleteStory(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const id = field(formData, 'id') ?? '';
  if (!id) return;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('stories')
    .select('slug, title, status')
    .eq('id', id)
    .single();

  await supabase.from('stories').delete().eq('id', id);

  revalidatePath('/library');

  revalidateTag('content');
  revalidatePath('/admin/stories');
  redirect('/admin/stories?deleted=1');
}

/**
 * The book a story is sold as.
 *
 * A story marked for sale gets a product in the Bookshop — same title,
 * cover and shelf, kind "ebook", the story linked through
 * product_stories so a purchase opens it. Change the price and the shop
 * changes; take it off sale and the product is archived, never deleted,
 * because orders point at it and readers who bought it keep it.
 */
async function syncStoryProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    storyId: string;
    slug: string;
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    coverImage: string | null;
    authorId: string | null;
    shelfId: string | null;
    forSale: boolean;
    price: number;
  },
) {
  const { data: link } = await supabase
    .from('product_stories')
    .select('product_id')
    .eq('story_id', input.storyId)
    .limit(1)
    .maybeSingle();
  const linkedId = (link?.product_id as string | undefined) ?? null;

  if (!input.forSale) {
    if (linkedId) {
      await supabase.from('products').update({ status: 'archived' }).eq('id', linkedId);
    }
    return;
  }

  const row = {
    title: input.title,
    subtitle: input.subtitle,
    kind: 'ebook',
    eyebrow: 'Soulfables Original',
    pull_quote: input.excerpt ?? input.subtitle ?? '',
    cta_label: 'Read it',
    status: 'published',
    cover_image: input.coverImage,
    author_id: input.authorId,
  };

  let productId = linkedId;
  if (productId) {
    const { error } = await supabase.from('products').update(row).eq('id', productId);
    if (error) console.error('[stories] product update', error.message);
  } else {
    // A slug of its own: the story's, unless a product already has it.
    const { data: taken } = await supabase.from('products').select('id').eq('slug', input.slug).maybeSingle();
    const slug = taken ? `${input.slug}-book` : input.slug;
    const { data: created, error } = await supabase.from('products').insert({ ...row, slug }).select('id').single();
    if (error || !created) {
      console.error('[stories] product insert', error?.message);
      return;
    }
    productId = created.id as string;
    await supabase.from('product_stories').insert({ product_id: productId, story_id: input.storyId, sort_order: 0 });
  }

  // The price: one default USD row, kept current.
  const amount = Math.round(input.price * 100);
  const { data: existingPrice } = await supabase
    .from('product_prices')
    .select('id')
    .eq('product_id', productId)
    .eq('is_default', true)
    .maybeSingle();
  if (existingPrice) {
    await supabase.from('product_prices').update({ unit_amount: amount, currency: 'USD', is_active: true }).eq('id', existingPrice.id);
  } else {
    await supabase.from('product_prices').insert({ product_id: productId, currency: 'USD', unit_amount: amount, provider: 'paypal', is_default: true, is_active: true });
  }

  // The shelf: the story's own.
  await supabase.from('product_shelves').delete().eq('product_id', productId);
  if (input.shelfId) {
    await supabase.from('product_shelves').insert({ product_id: productId, shelf_id: input.shelfId });
  }
  revalidatePath('/shop');
  revalidatePath(`/shop/${input.slug}`);
}

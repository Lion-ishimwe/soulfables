'use server';

import type { Route } from 'next';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff, requireViewer, getViewer, isStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { provisionAuthorAccount, revokeAccountFor } from '@/lib/author-accounts';
import { createClient } from '@/lib/supabase/server';
import { getWorkStory } from '@/lib/admin-data';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  demoGetStory,
  demoSaveStory,
  demoDeleteStory,
  demoSaveChapter,
  demoDeleteChapter,
  demoNotify,
  demoListAuthors,
  demoCreateAccount,
  demoRevokeAccount,
  demoAccountFor,
  demoMarkNotificationsRead,
  demoSaveAuthor,
} from '@/lib/demo/editorial';

/**
 * The editorial workflow.
 *
 * An author writes and submits; the House reviews; the House publishes.
 * The division is deliberate and enforced rather than trusted: an author
 * can move a story to `in_review` and no further. Publishing is a staff
 * action, which is the entire reason the review step exists.
 *
 * Handing a story on is a separate idea from the byline. `assignedAuthor`
 * is who is writing it now; `author` is whose name is on it. A story
 * begun by one writer and finished by another keeps its credit while the
 * work moves — otherwise reassignment would quietly rewrite authorship.
 */

export type WorkflowResult = { error?: string; message?: string };

function field(fd: FormData, name: string): string {
  const v = fd.get(name);
  return typeof v === 'string' ? v : '';
}

const slugRule = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
  .max(120);

/** Which author byline the signed-in person writes under, if any. */
async function viewerAuthorSlug(): Promise<string | null> {
  const viewer = await getViewer();
  if (!viewer?.email) return null;
  if (!isDemoMode()) return null;
  return demoAccountFor(viewer.email)?.authorSlug ?? null;
}

/** Staff, or the author this story is currently assigned to. */
async function canEdit(storySlug: string): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (isStaff(viewer.role)) return true;

  const mine = await viewerAuthorSlug();
  if (!mine) return false;

  const story = demoGetStory(storySlug);
  return Boolean(story && story.assignedAuthorSlug === mine);
}

// =====================================================================
// Submitting
// =====================================================================


// =====================================================================
// Two helpers, because the editorial workflow is five variations on one
// move: read a story, change a few fields, tell somebody.
//
// Every one of those five wrote to the demo store only, so in live mode
// submitting, approving, returning and reassigning all reported success
// and changed nothing. Consolidating here rather than repeating the
// live/demo branch five times is what makes that hard to reintroduce.
// =====================================================================

type StoryPatch = {
  status?: 'draft' | 'in_review' | 'published' | 'archived';
  submittedAt?: string | null;
  submittedById?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  revisionNote?: string | null;
  assignedAuthorSlug?: string | null;
};

/** Change a story's editorial state, in whichever store is real. */
async function patchStory(slug: string, patch: StoryPatch): Promise<string | null> {
  if (isDemoMode()) {
    const story = demoGetStory(slug);
    if (!story) return 'That story no longer exists.';

    demoSaveStory(slug, {
      ...story,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.submittedAt !== undefined ? { submittedAt: patch.submittedAt } : {}),
      ...(patch.approvedAt !== undefined ? { approvedAt: patch.approvedAt } : {}),
      ...(patch.publishedAt !== undefined ? { publishedAt: patch.publishedAt } : {}),
      ...(patch.revisionNote !== undefined ? { revisionNote: patch.revisionNote } : {}),
      ...(patch.assignedAuthorSlug !== undefined
        ? { assignedAuthorSlug: patch.assignedAuthorSlug }
        : {}),
    });
    return null;
  }

  const supabase = await createClient();
  const row: Record<string, unknown> = {};

  if (patch.status !== undefined) row.status = patch.status;
  if (patch.submittedAt !== undefined) row.submitted_at = patch.submittedAt;
  if (patch.submittedById !== undefined) row.submitted_by = patch.submittedById;
  if (patch.approvedAt !== undefined) row.approved_at = patch.approvedAt;
  if (patch.publishedAt !== undefined) row.published_at = patch.publishedAt;
  if (patch.revisionNote !== undefined) row.revision_note = patch.revisionNote;

  if (patch.assignedAuthorSlug !== undefined) {
    if (patch.assignedAuthorSlug === null) {
      row.assigned_author_id = null;
    } else {
      const { data: author } = await supabase
        .from('authors')
        .select('id')
        .eq('slug', patch.assignedAuthorSlug)
        .maybeSingle();
      if (!author) return 'No author with that name.';
      row.assigned_author_id = author.id as string;
    }
  }

  const { error } = await supabase.from('stories').update(row).eq('slug', slug);
  return error ? error.message : null;
}

/**
 * Tell an author something, by slug.
 *
 * Notifications belong to the person receiving them, and the RLS policy
 * scopes them to auth.uid() — so a writer cannot insert one addressed to
 * somebody else. That is why this needs the service role: the House is
 * writing into a reader's own list, which is exactly the case that policy
 * exists to prevent anyone else doing.
 */
async function notifyAuthor(
  authorSlug: string | null,
  note: { kind: string; title: string; body: string; href: string },
): Promise<void> {
  if (!authorSlug) return;

  if (isDemoMode()) {
    await notifyAuthor(authorSlug, { ...note });
    return;
  }

  const admin = createAdminClient();
  const { data: author } = await admin
    .from('authors')
    .select('user_id')
    .eq('slug', authorSlug)
    .maybeSingle();

  if (!author?.user_id) return;

  await admin.from('notifications').insert({
    user_id: author.user_id as string,
    kind: note.kind,
    title: note.title,
    body: note.body,
    href: note.href,
  });
}

export async function submitStory(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const viewer = await requireViewer('/studio');
  const slug = field(formData, 'slug');

  if (!(await canEdit(slug))) {
    return { error: 'That story is not yours to submit.' };
  }

  const story = await getWorkStory(slug);
  if (!story) return { error: 'That story no longer exists.' };

  if (story.status === 'published') {
    return { error: 'That story is already published.' };
  }

  const hasContent =
    story.releaseMode === 'serial'
      ? story.chapters.length > 0
      : story.bodyMdx.trim().length > 0;

  if (!hasContent) {
    return {
      error:
        story.releaseMode === 'serial'
          ? 'Add at least one chapter before submitting.'
          : 'There is nothing written yet.',
    };
  }

  const failed = await patchStory(slug, {
    status: 'in_review',
    submittedAt: new Date().toISOString(),
    submittedById: viewer.id,
    revisionNote: null,
  });
  if (failed) return { error: failed };

  revalidatePath('/studio');

  revalidateTag('content');
  revalidatePath('/admin/submissions');

  return {
    message:
      'Sent to the House. You will hear when it has been read — nothing more is needed from you.',
  };
}

// =====================================================================
// Reviewing — staff only
// =====================================================================

export async function approveStory(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const slug = field(formData, 'slug');
  const story = demoGetStory(slug);
  if (!story) return;

  const now = new Date().toISOString();

  await patchStory(slug, {
    status: 'published',
    approvedAt: now,
    publishedAt: story.publishedAt ?? now,
    revisionNote: null,
  });

  /*
   * Publishing a serial releases its first chapter if none is out yet.
   * A published serial with every episode still in draft is a library
   * entry a reader can open and find nothing behind.
   */
  const firstUnreleased =
    story.releaseMode === 'serial' && !story.chapters.some((c) => c.status === 'published')
      ? [...story.chapters].sort((a, b) => a.number - b.number)[0]
      : null;

  if (firstUnreleased) {
    if (isDemoMode()) {
      demoSaveChapter(slug, { ...firstUnreleased, status: 'published', publishedAt: now });
    } else {
      const supabase = await createClient();
      await supabase
        .from('story_chapters')
        .update({ status: 'published', published_at: now })
        .eq('id', firstUnreleased.id);
    }
  }

  // Tell whoever wrote it — the assigned author if there is one, the
  // byline otherwise.
  const tell = story.assignedAuthorSlug ?? story.authorSlug;
  if (tell) {
    await notifyAuthor(tell, {
      kind: 'story.published',
      title: `“${story.title}” is published`,
      body: `${viewer.displayName ?? 'The House'} approved it. It is live in the library now.`,
      href: `/story/${slug}`,
    });
  }

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect(`/admin/submissions?published=${encodeURIComponent(story.title)}` as Route);
}

export async function returnStory(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const slug = field(formData, 'slug');
  const note = field(formData, 'note').trim();
  const story = demoGetStory(slug);
  if (!story) return;

  await patchStory(slug, {
    status: 'draft',
    revisionNote: note || 'Sent back for another pass.',
  });

  const tell = story.assignedAuthorSlug ?? story.authorSlug;
  if (tell) {
    await notifyAuthor(tell, {
      kind: 'story.returned',
      title: `“${story.title}” came back`,
      body: note || 'The House would like another pass.',
      href: `/studio/${slug}`,
    });
  }

  revalidatePath('/studio');

  revalidateTag('content');
  redirect('/admin/submissions?returned=1' as Route);
}

/**
 * Hand a story to a different writer.
 *
 * The byline is left alone on purpose. Whoever started it keeps their
 * credit; this only moves who may work on it next.
 */
export async function reassignStory(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  await requireStaff();

  const slug = field(formData, 'slug');
  const to = field(formData, 'authorSlug');
  const note = field(formData, 'note').trim();

  const story = await getWorkStory(slug);
  if (!story) return { error: 'That story no longer exists.' };

  const { listAdminAuthors } = await import('@/lib/admin-data');
  const author = (await listAdminAuthors()).find((a) => a.slug === to);
  if (!author) return { error: 'Choose an author to hand it to.' };
  if (author.isPersona) {
    return { error: 'A House voice has nobody to hand it to.' };
  }

  const failed = await patchStory(slug, { assignedAuthorSlug: to, status: 'draft' });
  if (failed) return { error: failed };

  await notifyAuthor(to, {
    kind: 'story.assigned',
    title: `“${story.title}” has been handed to you`,
    body:
      note ||
      'Someone started this and it is yours to carry on. The byline stays with whoever began it.',
    href: `/studio/${slug}`,
  });

  revalidatePath('/admin/stories');
  revalidatePath('/studio');
  revalidateTag('content');

  return { message: `Handed to ${author.name}. They have been told.` };
}

// =====================================================================
// Chapters
// =====================================================================

const chapterSchema = z.object({
  storySlug: slugRule,
  id: z.string().trim().max(80).optional().or(z.literal('')),
  number: z.coerce.number().int().min(1).max(999),
  title: z.string().trim().min(1, 'A chapter needs a title.').max(200),
  bodyMdx: z.string().max(60000).optional().or(z.literal('')),
  publish: z.string().optional(),
});

export async function saveChapter(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const parsed = chapterSchema.safeParse({
    storySlug: field(formData, 'storySlug'),
    id: field(formData, 'id'),
    number: field(formData, 'number'),
    title: field(formData, 'title'),
    bodyMdx: field(formData, 'bodyMdx'),
    publish: field(formData, 'publish'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!(await canEdit(d.storySlug))) {
    return { error: 'That story is not yours to edit.' };
  }

  // Only staff may release an episode, for the same reason only staff
  // may publish a story.
  const viewer = await getViewer();
  const mayPublish = viewer ? isStaff(viewer.role) : false;
  const publish = d.publish === 'on' && mayPublish;

  const body = d.bodyMdx ?? '';
  // Counted here so the chapter list can show length without loading
  // every body — the columns exist for exactly this.
  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 220));

  if (isDemoMode()) {
    demoSaveChapter(d.storySlug, {
      id: d.id || `ch-${Date.now()}`,
      number: d.number,
      title: d.title,
      bodyMdx: body,
      status: publish ? 'published' : 'draft',
      publishedAt: publish ? new Date().toISOString() : null,
    });
  } else {
    const supabase = await createClient();

    const { data: story } = await supabase
      .from('stories')
      .select('id')
      .eq('slug', d.storySlug)
      .maybeSingle();

    if (!story) return { error: 'That story no longer exists.' };

    const row = {
      story_id: story.id as string,
      number: d.number,
      title: d.title,
      body_mdx: body,
      status: publish ? 'published' : 'draft',
      published_at: publish ? new Date().toISOString() : null,
      word_count: words,
      reading_minutes: minutes,
    };

    /*
     * Number is the identity of a chapter within a story, not the row id
     * — an author editing "chapter 3" means the third one, whether or not
     * they still have the id from when it was created. The unique index
     * on (story_id, number) makes that safe to lean on.
     */
    const { error } = d.id
      ? await supabase.from('story_chapters').update(row).eq('id', d.id)
      : await supabase
          .from('story_chapters')
          .upsert(row, { onConflict: 'story_id,number' });

    if (error) {
      return {
        error:
          error.code === '23505'
            ? `There is already a chapter ${d.number}. Give this one the next number.`
            : error.message,
      };
    }
  }

  revalidatePath('/', 'layout');

  revalidateTag('content');

  return {
    message: publish
      ? `Chapter ${d.number} released.`
      : `Chapter ${d.number} saved as a draft.`,
  };
}

export async function removeChapter(formData: FormData): Promise<void> {
  const storySlug = field(formData, 'storySlug');
  if (!(await canEdit(storySlug))) return;

  if (isDemoMode()) {
    demoDeleteChapter(storySlug, field(formData, 'id'));
  } else {
    const supabase = await createClient();
    await supabase.from('story_chapters').delete().eq('id', field(formData, 'id'));
  }

  revalidatePath('/', 'layout');
  revalidateTag('content');
}

export async function publishChapter(formData: FormData): Promise<void> {
  await requireStaff();
  const storySlug = field(formData, 'storySlug');
  const id = field(formData, 'id');

  if (isDemoMode()) {
    const story = demoGetStory(storySlug);
    const chapter = story?.chapters.find((c) => c.id === id);
    if (!story || !chapter) return;

    demoSaveChapter(storySlug, {
      ...chapter,
      status: 'published',
      publishedAt: new Date().toISOString(),
    });

    const tell = story.assignedAuthorSlug ?? story.authorSlug;
    if (tell) {
      await notifyAuthor(tell, {
        kind: 'story.published',
        title: `Chapter ${chapter.number} of “${story.title}” is out`,
        body: chapter.title,
        href: `/story/${storySlug}`,
      });
    }
  } else {
    const supabase = await createClient();

    const { data: chapter } = await supabase
      .from('story_chapters')
      .select('number, title, stories(title, assigned_author_id, author_id)')
      .eq('id', id)
      .maybeSingle();

    if (!chapter) return;

    await supabase
      .from('story_chapters')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id);

    /*
     * Tell whoever is carrying the story, falling back to whoever's name
     * is on it. Notifications are written with the service role because
     * they belong to somebody else — a reader cannot insert a row scoped
     * to another user's id, which is the policy doing its job.
     */
    const parent = (Array.isArray(chapter.stories) ? chapter.stories[0] : chapter.stories) as
      | { title: string; assigned_author_id: string | null; author_id: string | null }
      | null;

    const authorId = parent?.assigned_author_id ?? parent?.author_id ?? null;
    if (authorId) {
      const admin = createAdminClient();
      const { data: author } = await admin
        .from('authors')
        .select('user_id')
        .eq('id', authorId)
        .maybeSingle();

      if (author?.user_id) {
        await admin.from('notifications').insert({
          user_id: author.user_id as string,
          kind: 'story.published',
          title: `Chapter ${chapter.number} of “${parent?.title ?? 'your story'}” is out`,
          body: chapter.title as string,
          href: `/story/${storySlug}`,
        });
      }
    }
  }

  revalidatePath('/', 'layout');

  revalidateTag('content');
}

// =====================================================================
// Author accounts
// =====================================================================

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  authorSlug: slugRule,
});

/**
 * Give an existing author a way in.
 *
 * Live mode creates a real account, links it to the author row and sends
 * a notification; demo mode writes to the in-process store. Until now
 * only the second existed, so in live mode this reported success and
 * created nothing.
 *
 * The temporary password is returned to the person doing the inviting
 * rather than emailed, because no email provider is connected yet.
 * Saying so is better than a silent half-measure.
 */
export async function createAuthorAccount(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const viewer = await requireStaff();

  const parsed = accountSchema.safeParse({
    email: field(formData, 'email'),
    authorSlug: field(formData, 'authorSlug'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (isDemoMode()) {
    const author = demoListAuthors().find((a) => a.slug === parsed.data.authorSlug);
    if (!author) return { error: 'Choose which author this account writes as.' };
    if (author.isPersona) {
      return { error: 'A House voice is not a person and cannot sign in.' };
    }

    const result = demoCreateAccount({
      email: parsed.data.email,
      authorSlug: parsed.data.authorSlug,
      invitedAt: new Date().toISOString(),
    });
    if (result.error) return { error: result.error };

    await notifyAuthor(parsed.data.authorSlug, {
      kind: 'account.created',
      title: 'Welcome to the writing room',
      body: `${viewer.displayName ?? 'The House'} gave you an account. Anything you write comes to us before it goes out.`,
      href: '/studio',
    });

    revalidatePath('/admin/authors');
    return { message: `${author.name} can now sign in with ${parsed.data.email} and write.` };
  }

  const supabase = await createClient();
  const { data: author } = await supabase
    .from('authors')
    .select('slug, name, is_persona, user_id')
    .eq('slug', parsed.data.authorSlug)
    .single();

  if (!author) return { error: 'Choose which author this account writes as.' };
  if (author.is_persona) {
    return { error: 'A House voice is not a person and cannot sign in.' };
  }
  if (author.user_id) {
    return { error: `${author.name} already has an account.` };
  }

  const result = await provisionAuthorAccount({
    authorSlug: parsed.data.authorSlug,
    email: parsed.data.email,
    invitedBy: viewer.id,
    displayName: author.name as string,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath('/admin/authors');

  return {
    message: `${author.name} can sign in with ${parsed.data.email}. Their temporary password is ${result.password} — send it to them and ask them to change it. It is not shown again.`,
  };
}

export async function revokeAuthorAccount(formData: FormData): Promise<void> {
  await requireStaff();

  if (isDemoMode()) {
    demoRevokeAccount(field(formData, 'email'));
  } else {
    // The byline and everything published under it stay exactly as they
    // are. What goes is the ability to sign in.
    const slug = field(formData, 'authorSlug');
    if (slug) await revokeAccountFor(slug);
  }

  revalidatePath('/admin/authors');
}

// =====================================================================
// Notifications
// =====================================================================

export async function markNotificationsRead(): Promise<void> {
  const mine = await viewerAuthorSlug();
  if (isDemoMode()) {
    if (mine) demoMarkNotificationsRead(mine);
  } else {
    /*
     * Only your own, and the policy says so as well — notifications are
     * scoped to auth.uid() for update as well as select, so this cannot
     * mark somebody else's list read even if the slug were wrong.
     */
    const supabase = await createClient();
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
  }
  revalidatePath('/studio');
  revalidateTag('content');
}

/** Discard a story from the studio or the admin. */
export async function discardStory(formData: FormData): Promise<void> {
  const slug = field(formData, 'slug');
  if (!(await canEdit(slug))) return;

  if (isDemoMode()) {
    demoDeleteStory(slug);
  } else {
    /*
     * Chapters, shelf links and audio go with it — every one of those
     * tables carries ON DELETE CASCADE from stories, so this is one
     * statement rather than four, and cannot leave orphans if it fails
     * halfway.
     */
    const supabase = await createClient();
    const { error } = await supabase.from('stories').delete().eq('slug', slug);

    // A delete that removed nothing must not report that it did. This
    // said "Story deleted." to somebody watching the story stay exactly
    // where it was.
    if (error) {
      redirect(`/admin/stories?error=${encodeURIComponent(error.message)}` as Route);
    }
  }

  revalidatePath('/', 'layout');
  revalidateTag('content');
  redirect('/admin/stories?deleted=1' as Route);
}

// =====================================================================
// Uploading a written template
// =====================================================================

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Turn a filled-in template into a draft story.
 *
 * It always arrives as a draft, whoever uploads it — a file landing
 * straight on the public site would make the review step optional, and
 * the review step is the point.
 */
export async function uploadStoryTemplate(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const viewer = await requireViewer('/studio');
  const file = formData.get('file') as File | null;

  if (!file || file.size === 0) return { error: 'Choose a file to upload.' };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is larger than 2 MB — is it definitely a story?' };
  }

  const name = file.name.toLowerCase();
  if (!/\.(md|markdown|txt)$/.test(name)) {
    return {
      error: 'Upload the .md template you downloaded, or a plain text file.',
    };
  }

  const { parseTemplate } = await import('@/lib/story-template');
  const parsed = parseTemplate(await file.text());

  if ('error' in parsed) return { error: parsed.error };

  const slugBase =
    parsed.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 110) || 'untitled';

  // Never overwrite an existing story on upload.
  const { listAdminAuthors, listWorkStories } = await import('@/lib/admin-data');
  const taken = new Set((await listWorkStories()).map((s) => s.slug));

  let slug = slugBase;
  let n = 2;
  while (taken.has(slug)) slug = `${slugBase}-${n++}`;

  const authors = await listAdminAuthors();
  const mine = await viewerAuthorSlug();

  const byName = parsed.author
    ? authors.find(
        (a) => a.name.toLowerCase() === parsed.author!.toLowerCase(),
      )?.slug
    : null;

  const authorSlug = mine ?? byName ?? null;
  const words = parsed.body.trim().split(/\s+/).filter(Boolean).length;

  if (isDemoMode()) {
    demoSaveStory(null, {
      slug,
      title: parsed.title,
      subtitle: parsed.subtitle,
      excerpt: '',
      bodyMdx: parsed.body,
      authorSlug,
      assignedAuthorSlug: mine ?? authorSlug,
      shelfSlug: parsed.shelf ?? 'heartbreak',
      access: parsed.access,
      status: 'draft',
      releaseMode: parsed.release,
      chapters:
        parsed.release === 'serial'
          ? parsed.sections.map((sec, i) => ({
              id: `ch-${Date.now()}-${i}`,
              number: i + 1,
              title: sec.title,
              bodyMdx: sec.body,
              status: 'draft' as const,
              publishedAt: null,
            }))
          : [],
      coverImage: null,
      readingMinutes: Math.max(1, Math.ceil(words / 220)),
      publishedAt: null,
      submittedAt: null,
      submittedBy: viewer.email,
      approvedAt: null,
      revisionNote: null,
      hasAudio: false,
    });
  } else {
    /*
     * A template becomes a real draft: the story row, its shelf link, and
     * a chapter per section when it was written as a serial.
     *
     * This wrote only to the demo store, so an author could upload a
     * finished manuscript, watch it appear, and have nothing exist. It is
     * the entry point to the whole editorial workflow, which made it the
     * worst one to have been pretending.
     */
    const supabase = await createClient();

    const authorId = authorSlug
      ? ((await supabase.from('authors').select('id').eq('slug', authorSlug).maybeSingle()).data
          ?.id as string | undefined)
      : undefined;

    const { data: created, error } = await supabase
      .from('stories')
      .insert({
        slug,
        title: parsed.title,
        subtitle: parsed.subtitle || null,
        body_mdx: parsed.release === 'serial' ? '' : parsed.body,
        author_id: authorId ?? null,
        assigned_author_id: authorId ?? null,
        status: 'draft',
        access: 'free',
        release_mode: parsed.release,
        word_count: words,
        reading_minutes: Math.max(1, Math.ceil(words / 220)),
      })
      .select('id')
      .single();

    if (error || !created) {
      return { error: error?.message ?? 'The story could not be created.' };
    }

    const shelfSlug = parsed.shelf ?? 'heartbreak';
    const { data: shelf } = await supabase
      .from('shelves')
      .select('id')
      .eq('slug', shelfSlug)
      .maybeSingle();

    if (shelf) {
      await supabase
        .from('story_shelves')
        .insert({ story_id: created.id, shelf_id: shelf.id, is_primary: true, sort_order: 0 });
    }

    if (parsed.release === 'serial' && parsed.sections.length) {
      await supabase.from('story_chapters').insert(
        parsed.sections.map((sec, i) => {
          const w = sec.body.trim().split(/\s+/).filter(Boolean).length;
          return {
            story_id: created.id,
            number: i + 1,
            title: sec.title,
            body_mdx: sec.body,
            status: 'draft',
            word_count: w,
            reading_minutes: Math.max(1, Math.ceil(w / 220)),
          };
        }),
      );
    }
  }

  revalidatePath('/admin/stories');
  revalidatePath('/studio');
  revalidateTag('content');

  const notes = [
    `“${parsed.title}” came in as a draft.`,
    parsed.release === 'serial'
      ? `${parsed.sections.length} chapters found.`
      : `${words.toLocaleString()} words.`,
    ...parsed.warnings,
  ];

  return { message: notes.join(' ') };
}

// =====================================================================
// Adding a writer
// =====================================================================

const newAuthorSchema = z.object({
  name: z.string().trim().min(1, 'A writer needs a name.').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('That does not look like an email address.'),
  bio: z.string().trim().max(2000).optional(),
});

/**
 * Turn a name and an address into a writer who can sign in.
 *
 * Deliberately not the same thing as the old two-step flow, which
 * created a byline and then, separately, an account for it. An author IS
 * a person here: they have a name, a way in, and something to say about
 * themselves. A byline with nobody behind it is a different and rarer
 * thing, and the edit page still makes one.
 *
 * Three fields, no more. The URL is derived from the name and the
 * position is the end of the list — both are editorial details nobody
 * should have to decide while adding a person, and both are editable
 * afterwards.
 */
export async function createAuthorWithAccount(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const viewer = await requireStaff();

  const parsed = newAuthorSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    bio: field(formData, 'bio'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, bio } = parsed.data;

  /** A readable URL, and one that cannot collide with an existing author. */
  const baseSlug =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'author';

  if (isDemoMode()) {
    const taken = new Set(demoListAuthors().map((a) => a.slug));
    let slug = baseSlug;
    for (let n = 2; taken.has(slug); n++) slug = `${baseSlug}-${n}`;

    const saved = demoSaveAuthor(null, {
      slug,
      name,
      bio: bio || null,
      avatarUrl: null,
      isPersona: false,
      sortOrder: demoListAuthors().length,
    });
    if (saved.error) return { error: saved.error };

    const account = demoCreateAccount({
      email,
      authorSlug: slug,
      invitedAt: new Date().toISOString(),
    });
    if (account.error) return { error: account.error };

    await notifyAuthor(slug, {
      kind: 'account.created',
      title: 'Welcome to the writing room',
      body: `${viewer.displayName ?? 'The House'} added you. Anything you write comes to us before it goes out.`,
      href: '/studio',
    });

    revalidatePath('/admin/authors');
    return { message: `${name} can now sign in with ${email} and write.` };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('authors')
    .select('slug')
    .like('slug', `${baseSlug}%`);

  const taken = new Set((existing ?? []).map((r) => r.slug as string));
  let slug = baseSlug;
  for (let n = 2; taken.has(slug); n++) slug = `${baseSlug}-${n}`;

  // Append to the end of the list rather than asking for a position.
  const { count } = await supabase
    .from('authors')
    .select('id', { count: 'exact', head: true });

  const { error: insertError } = await supabase.from('authors').insert({
    slug,
    name,
    bio: bio || null,
    is_persona: false,
    sort_order: count ?? 0,
  });

  if (insertError) {
    return {
      error:
        insertError.code === '23505'
          ? 'An author with that name already exists.'
          : insertError.message,
    };
  }

  const result = await provisionAuthorAccount({
    authorSlug: slug,
    email,
    invitedBy: viewer.id,
    displayName: name,
  });

  if (!result.ok) {
    /*
     * The author row exists but nobody can sign in as them, which is a
     * half-made thing the admin would have to clean up by hand. Remove
     * it and report the reason the account failed, which is the part
     * that actually needs fixing.
     */
    await supabase.from('authors').delete().eq('slug', slug);
    return { error: result.error };
  }

  revalidatePath('/admin/authors');

  return {
    message: `${name} can sign in with ${email}. Their temporary password is ${result.password} — send it to them and ask them to change it. It is not shown again.`,
  };
}

/** An author, editing their own description of themselves. */
export async function updateOwnBio(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  await requireViewer();

  const bio = field(formData, 'bio') ?? '';
  if (bio.length > 2000) {
    return { error: 'A biography of more than 2000 characters is a story, not a biography.' };
  }

  if (isDemoMode()) {
    const slug = await viewerAuthorSlug();
    if (!slug) return { error: 'You do not have an author page to edit.' };
    const author = demoListAuthors().find((a) => a.slug === slug);
    if (!author) return { error: 'You do not have an author page to edit.' };

    demoSaveAuthor(slug, { ...author, bio: bio.trim() || null });
    revalidatePath('/studio');
    revalidateTag('content');
    return { message: 'Saved.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('update_own_author_bio', { p_bio: bio });

  if (error) return { error: error.message };

  revalidatePath('/studio');

  revalidateTag('content');
  revalidatePath('/voices');
  revalidateTag('content');
  return { message: 'Saved. Readers will see this on your stories.' };
}

/**
 * A story's cover, set by whoever is carrying it.
 *
 * Scoped through canEdit(), the same guard the chapter forms use — an
 * author may change the cover of a story assigned to them and nothing
 * else. Staff may change any, because staff may change any story.
 *
 * Authors could not set a cover at all before this: the field existed in
 * the admin and nowhere in the writing room, so the person who wrote the
 * story was the one person who could not choose its face.
 */
export async function saveStoryCover(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const slug = field(formData, 'storySlug');
  const cover = (field(formData, 'coverImage') ?? '').trim();

  if (!(await canEdit(slug))) {
    return { error: 'That story is not yours to edit.' };
  }

  if (cover && !/^https?:\/\//i.test(cover)) {
    return { error: 'That is not an image address. Upload a file, or paste a link beginning https://' };
  }

  if (isDemoMode()) {
    const story = demoGetStory(slug);
    if (!story) return { error: 'That story no longer exists.' };
    demoSaveStory(slug, { ...story, coverImage: cover || null });
  } else {
    const supabase = await createClient();
    const { error } = await supabase
      .from('stories')
      .update({ cover_image: cover || null })
      .eq('slug', slug);

    if (error) return { error: error.message };
  }

  revalidatePath('/studio');
  revalidatePath('/admin/stories');
  revalidateTag('content');

  return { message: cover ? 'Cover saved.' : 'Back to the drawn cover.' };
}

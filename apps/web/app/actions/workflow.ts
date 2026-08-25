'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff, requireViewer, getViewer, isStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
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

export async function submitStory(
  _prev: WorkflowResult,
  formData: FormData,
): Promise<WorkflowResult> {
  const viewer = await requireViewer('/studio');
  const slug = field(formData, 'slug');

  if (!(await canEdit(slug))) {
    return { error: 'That story is not yours to submit.' };
  }

  const story = demoGetStory(slug);
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

  demoSaveStory(slug, {
    ...story,
    status: 'in_review',
    submittedAt: new Date().toISOString(),
    submittedBy: viewer.email,
    revisionNote: null,
  });

  revalidatePath('/studio');
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

  demoSaveStory(slug, {
    ...story,
    status: 'published',
    approvedAt: now,
    publishedAt: story.publishedAt ?? now,
    revisionNote: null,
    // Publishing a serial releases its first chapter if none is out yet.
    chapters:
      story.releaseMode === 'serial' && !story.chapters.some((c) => c.status === 'published')
        ? story.chapters.map((c, i) =>
            i === 0 ? { ...c, status: 'published' as const, publishedAt: now } : c,
          )
        : story.chapters,
  });

  // Tell whoever wrote it — the assigned author if there is one, the
  // byline otherwise.
  const tell = story.assignedAuthorSlug ?? story.authorSlug;
  if (tell) {
    demoNotify({
      forAuthor: tell,
      kind: 'story.published',
      title: `“${story.title}” is published`,
      body: `${viewer.displayName ?? 'The House'} approved it. It is live in the library now.`,
      href: `/story/${slug}`,
    });
  }

  revalidatePath('/', 'layout');
  redirect(`/admin/submissions?published=${encodeURIComponent(story.title)}` as Route);
}

export async function returnStory(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const slug = field(formData, 'slug');
  const note = field(formData, 'note').trim();
  const story = demoGetStory(slug);
  if (!story) return;

  demoSaveStory(slug, {
    ...story,
    status: 'draft',
    revisionNote: note || 'Sent back for another pass.',
  });

  const tell = story.assignedAuthorSlug ?? story.authorSlug;
  if (tell) {
    demoNotify({
      forAuthor: tell,
      kind: 'story.returned',
      title: `“${story.title}” came back`,
      body: note || 'The House would like another pass.',
      href: `/studio/${slug}`,
    });
  }

  revalidatePath('/studio');
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

  const story = demoGetStory(slug);
  if (!story) return { error: 'That story no longer exists.' };

  const author = demoListAuthors().find((a) => a.slug === to);
  if (!author) return { error: 'Choose an author to hand it to.' };
  if (author.isPersona) {
    return { error: 'A House voice has nobody to hand it to.' };
  }

  demoSaveStory(slug, { ...story, assignedAuthorSlug: to, status: 'draft' });

  demoNotify({
    forAuthor: to,
    kind: 'story.assigned',
    title: `“${story.title}” has been handed to you`,
    body:
      note ||
      'Someone started this and it is yours to carry on. The byline stays with whoever began it.',
    href: `/studio/${slug}`,
  });

  revalidatePath('/admin/stories');
  revalidatePath('/studio');

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

  demoSaveChapter(d.storySlug, {
    id: d.id || `ch-${Date.now()}`,
    number: d.number,
    title: d.title,
    bodyMdx: d.bodyMdx ?? '',
    status: publish ? 'published' : 'draft',
    publishedAt: publish ? new Date().toISOString() : null,
  });

  revalidatePath('/', 'layout');

  return {
    message: publish
      ? `Chapter ${d.number} released.`
      : `Chapter ${d.number} saved as a draft.`,
  };
}

export async function removeChapter(formData: FormData): Promise<void> {
  const storySlug = field(formData, 'storySlug');
  if (!(await canEdit(storySlug))) return;

  demoDeleteChapter(storySlug, field(formData, 'id'));
  revalidatePath('/', 'layout');
}

export async function publishChapter(formData: FormData): Promise<void> {
  await requireStaff();
  const storySlug = field(formData, 'storySlug');
  const id = field(formData, 'id');

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
    demoNotify({
      forAuthor: tell,
      kind: 'story.published',
      title: `Chapter ${chapter.number} of “${story.title}” is out`,
      body: chapter.title,
      href: `/story/${storySlug}`,
    });
  }

  revalidatePath('/', 'layout');
}

// =====================================================================
// Author accounts
// =====================================================================

const accountSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  authorSlug: slugRule,
});

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

  demoNotify({
    forAuthor: parsed.data.authorSlug,
    kind: 'account.created',
    title: 'Welcome to the writing room',
    body: `${viewer.displayName ?? 'The House'} gave you an account. Anything you write comes to us before it goes out.`,
    href: '/studio',
  });

  revalidatePath('/admin/authors');

  return {
    message: `${author.name} can now sign in with ${parsed.data.email} and write.`,
  };
}

export async function revokeAuthorAccount(formData: FormData): Promise<void> {
  await requireStaff();
  demoRevokeAccount(field(formData, 'email'));
  revalidatePath('/admin/authors');
}

// =====================================================================
// Notifications
// =====================================================================

export async function markNotificationsRead(): Promise<void> {
  const mine = await viewerAuthorSlug();
  if (mine) demoMarkNotificationsRead(mine);
  revalidatePath('/studio');
}

/** Discard a story from the studio or the admin. */
export async function discardStory(formData: FormData): Promise<void> {
  const slug = field(formData, 'slug');
  if (!(await canEdit(slug))) return;

  demoDeleteStory(slug);
  revalidatePath('/', 'layout');
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
  let slug = slugBase;
  let n = 2;
  while (demoGetStory(slug)) slug = `${slugBase}-${n++}`;

  const authors = demoListAuthors();
  const mine = await viewerAuthorSlug();

  const byName = parsed.author
    ? authors.find(
        (a) => a.name.toLowerCase() === parsed.author!.toLowerCase(),
      )?.slug
    : null;

  const authorSlug = mine ?? byName ?? null;
  const words = parsed.body.trim().split(/\s+/).filter(Boolean).length;

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

  revalidatePath('/admin/stories');
  revalidatePath('/studio');

  const notes = [
    `“${parsed.title}” came in as a draft.`,
    parsed.release === 'serial'
      ? `${parsed.sections.length} chapters found.`
      : `${words.toLocaleString()} words.`,
    ...parsed.warnings,
  ];

  return { message: notes.join(' ') };
}

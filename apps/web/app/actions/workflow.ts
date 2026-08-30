'use server';

import type { Route } from 'next';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireStaff, requireViewer, getViewer, isStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { provisionAuthorAccount, revokeAccountFor } from '@/lib/author-accounts';
import { createClient } from '@/lib/supabase/server';
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

  revalidateTag('content');
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

  demoSaveChapter(d.storySlug, {
    id: d.id || `ch-${Date.now()}`,
    number: d.number,
    title: d.title,
    bodyMdx: d.bodyMdx ?? '',
    status: publish ? 'published' : 'draft',
    publishedAt: publish ? new Date().toISOString() : null,
  });

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

  demoDeleteChapter(storySlug, field(formData, 'id'));
  revalidatePath('/', 'layout');
  revalidateTag('content');
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

    demoNotify({
      forAuthor: parsed.data.authorSlug,
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
  if (mine) demoMarkNotificationsRead(mine);
  revalidatePath('/studio');
  revalidateTag('content');
}

/** Discard a story from the studio or the admin. */
export async function discardStory(formData: FormData): Promise<void> {
  const slug = field(formData, 'slug');
  if (!(await canEdit(slug))) return;

  demoDeleteStory(slug);
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

    demoNotify({
      forAuthor: slug,
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

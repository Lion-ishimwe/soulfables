'use server';

import { z } from 'zod';
import { field } from '@/lib/form';
import { canEditStory, viewerAuthorSlug } from '@/lib/can-edit';
import { getViewer, isStaff } from '@/lib/auth';
import {
  draftStory,
  continueWriting,
  suggestTitles,
  proposeConcepts,
  writingAvailable,
  type Concept,
} from '@/lib/ai/writing';

export type AssistResult = { text?: string; error?: string };
export type ConceptsResult = { concepts?: Concept[]; error?: string };

/** Staff, or anyone with a desk in the Writing Room. */
async function canWrite(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (isStaff(viewer.role)) return true;
  return Boolean(await viewerAuthorSlug());
}

const conceptSchema = z.object({
  title: z.string().trim().min(1, 'Give it a title first, even a working one.').max(200),
  description: z
    .string()
    .trim()
    .min(40, 'Say a little more — what happens, and to whom.')
    .max(3000, 'That is a draft, not a description. Keep it to a paragraph or two.'),
  shelfSlug: z.string().trim().max(60).optional(),
});

const briefSchema = z.object({
  brief: z.string().trim().min(20, 'Say a little more — a sentence or two of what happens.').max(4000),
  shelfSlug: z.string().trim().optional(),
  title: z.string().trim().max(200).optional(),
});

/**
 * The writing assistant, as server actions.
 *
 * Every one returns text and saves nothing. What comes back goes into a
 * box the writer edits; the existing save actions are the only things
 * that write a story. Keeping the two apart means an assistant that goes
 * wrong produces a bad suggestion rather than a bad story in the library.
 *
 * Scoped through the same guard the chapter forms use, so an author can
 * only ask for help with a story that is theirs to write.
 */
export async function assistDraft(
  _prev: AssistResult,
  formData: FormData,
): Promise<AssistResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const slug = field(formData, 'storySlug');
  if (slug && !(await canEditStory(slug))) {
    return { error: 'That story is not yours to write.' };
  }

  const parsed = briefSchema.safeParse({
    brief: field(formData, 'brief'),
    shelfSlug: field(formData, 'shelfSlug'),
    title: field(formData, 'title'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await draftStory({ ...parsed.data, storySlug: slug || undefined });
  return result.ok ? { text: result.text } : { error: result.error };
}

export async function assistContinue(
  _prev: AssistResult,
  formData: FormData,
): Promise<AssistResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const slug = field(formData, 'storySlug');
  if (slug && !(await canEditStory(slug))) {
    return { error: 'That story is not yours to write.' };
  }

  const existing = field(formData, 'existing') ?? '';
  if (existing.trim().split(/\s+/).length < 40) {
    return { error: 'Write a little further first — there is not enough here to continue from.' };
  }

  const result = await continueWriting({
    existing,
    shelfSlug: field(formData, 'shelfSlug') || undefined,
    note: field(formData, 'note') || undefined,
    storySlug: slug || undefined,
  });

  return result.ok ? { text: result.text } : { error: result.error };
}

export async function assistTitles(
  _prev: AssistResult,
  formData: FormData,
): Promise<AssistResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const slug = field(formData, 'storySlug');
  if (slug && !(await canEditStory(slug))) {
    return { error: 'That story is not yours to write.' };
  }

  const body = field(formData, 'body') ?? '';
  if (body.trim().split(/\s+/).length < 60) {
    return { error: 'There is not enough written yet to name it.' };
  }

  const result = await suggestTitles({
    body,
    shelfSlug: field(formData, 'shelfSlug') || undefined,
    storySlug: slug || undefined,
  });

  return result.ok ? { text: result.text } : { error: result.error };
}

/**
 * Concepts from a title and a description.
 *
 * Called as the writer finishes describing the idea, not only on a
 * button — so it is guarded the same as everything else here and costs
 * the same, and the panel that calls it is careful not to call it twice
 * for the same words.
 */
export async function assistConcepts(
  _prev: ConceptsResult,
  formData: FormData,
): Promise<ConceptsResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }
  if (!(await canWrite())) {
    return { error: 'The Writing Room is for the House\'s writers.' };
  }

  const parsed = conceptSchema.safeParse({
    title: field(formData, 'title'),
    description: field(formData, 'description'),
    shelfSlug: field(formData, 'shelfSlug') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await proposeConcepts(parsed.data);
  return result.ok ? { concepts: result.concepts } : { error: result.error };
}

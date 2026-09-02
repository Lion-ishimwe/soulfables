'use server';

import { z } from 'zod';
import { field } from '@/lib/form';
import { canEditStory } from '@/lib/can-edit';
import { draftStory, continueWriting, suggestTitles, writingAvailable } from '@/lib/ai/writing';

export type AssistResult = { text?: string; error?: string };

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
    return { error: 'No AI provider is connected. Settings → Connections shows what is missing.' };
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

  const result = await draftStory(parsed.data);
  return result.ok ? { text: result.text } : { error: result.error };
}

export async function assistContinue(
  _prev: AssistResult,
  formData: FormData,
): Promise<AssistResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Connections shows what is missing.' };
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
  });

  return result.ok ? { text: result.text } : { error: result.error };
}

export async function assistTitles(
  _prev: AssistResult,
  formData: FormData,
): Promise<AssistResult> {
  if (!writingAvailable()) {
    return { error: 'No AI provider is connected. Settings → Connections shows what is missing.' };
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
  });

  return result.ok ? { text: result.text } : { error: result.error };
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/auth';

/**
 * Reading actions: keeping a story, marking a place, recording progress.
 *
 * Every one of these writes a row keyed on the signed-in reader and lets
 * RLS scope it. None of them takes a user id from the caller — the only
 * user any of these can act for is the one holding the session.
 *
 * They return quietly rather than throwing when there is no session.
 * Progress is ambient: a signed-out reader still gets to read, they just
 * do not get to have their place remembered, and that is not an error
 * worth interrupting them for.
 */

export type ToggleResult = { saved?: boolean; error?: string };

const uuid = z.string().uuid();

export async function toggleSaved(formData: FormData): Promise<ToggleResult> {
  const viewer = await getViewer();
  if (!viewer) return { error: 'sign-in-required' };

  const parsed = uuid.safeParse(formData.get('storyId'));
  if (!parsed.success) return { error: 'unknown-story' };

  const supabase = await createClient();
  const storyId = parsed.data;

  const { data: existing } = await supabase
    .from('saved_stories')
    .select('story_id')
    .eq('story_id', storyId)
    .maybeSingle();

  if (existing) {
    await supabase.from('saved_stories').delete().eq('story_id', storyId);
    revalidatePath('/account/library');
    return { saved: false };
  }

  await supabase
    .from('saved_stories')
    .insert({ user_id: viewer.id, story_id: storyId });

  revalidatePath('/account/library');
  return { saved: true };
}

const progressSchema = z.object({
  storyId: uuid,
  // 0..1. Clamped rather than rejected: a rounding error at the end of a
  // story should not lose someone's place.
  percent: z.coerce.number().min(0).max(1).catch(0),
  sectionId: z.string().uuid().nullish(),
  charOffset: z.coerce.number().int().min(0).nullish(),
  completed: z.boolean().optional(),
});

/**
 * Record where a reader has got to.
 *
 * Called from a beacon as they scroll, so it must be cheap and must never
 * fail loudly. An upsert on (user_id, story_id) keeps exactly one row per
 * reader per story.
 */
export async function recordProgress(input: {
  storyId: string;
  percent: number;
  sectionId?: string | null;
  charOffset?: number | null;
  completed?: boolean;
}): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };

  const parsed = progressSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from('reading_progress').upsert(
    {
      user_id: viewer.id,
      story_id: d.storyId,
      percent: d.percent,
      section_id: d.sectionId ?? null,
      char_offset: d.charOffset ?? null,
      last_read_at: new Date().toISOString(),
      // Only ever set completed_at; never clear it. Finishing a story is
      // not undone by scrolling back up to reread the opening.
      ...(d.completed ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: 'user_id,story_id' },
  );

  if (error) {
    console.error('[reading] progress upsert', error.message);
    return { ok: false };
  }

  return { ok: true };
}

const passageSchema = z.object({
  storyId: uuid,
  quote: z.string().trim().min(2).max(2000),
  sectionId: z.string().uuid().nullish(),
});

/**
 * "Some sentences ask to be remembered."
 *
 * The quoted text is stored, not just a pair of offsets. If the story is
 * later edited, the reader keeps the sentence they actually kept.
 */
export async function savePassage(input: {
  storyId: string;
  quote: string;
  sectionId?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: 'sign-in-required' };

  const parsed = passageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const supabase = await createClient();
  const { error } = await supabase.from('saved_passages').insert({
    user_id: viewer.id,
    story_id: parsed.data.storyId,
    quote: parsed.data.quote,
    section_id: parsed.data.sectionId ?? null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/account/library');
  return { ok: true };
}

export async function addBookmark(input: {
  storyId: string;
  sectionId?: string | null;
  charOffset?: number | null;
  note?: string;
}): Promise<{ ok: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from('bookmarks').insert({
    user_id: viewer.id,
    story_id: input.storyId,
    section_id: input.sectionId ?? null,
    char_offset: input.charOffset ?? null,
    note: input.note?.trim() || null,
  });

  revalidatePath('/account/library');
  return { ok: !error };
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireViewer } from '@/lib/auth';

/**
 * Journal actions.
 *
 * The strictest surface in the product. Three things hold it:
 *
 *   1. RLS scopes every read and write to the author, and no policy grants
 *      staff access — an administrator can see that a reader has fourteen
 *      entries, never what any of them says.
 *   2. Nothing here accepts a user id. The only person any of these can
 *      write for is the one holding the session.
 *   3. `ai_opt_in` defaults to false and is only ever set by an explicit
 *      choice on the form. "Private by default" has to survive the AI
 *      companion, so consent is per entry, not just per account.
 */

export type JournalResult = { error?: string; message?: string; id?: string };

const entrySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first — even one line.')
    .max(20000, 'That entry is longer than the journal can hold.'),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  moodId: z.string().uuid().optional().or(z.literal('')),
  storyId: z.string().uuid().optional().or(z.literal('')),
  promptId: z.string().uuid().optional().or(z.literal('')),
  aiOptIn: z.string().optional(),
});

export async function saveEntry(
  _prev: JournalResult,
  formData: FormData,
): Promise<JournalResult> {
  const viewer = await requireViewer('/journal');

  const parsed = entrySchema.safeParse({
    body: formData.get('body'),
    title: formData.get('title'),
    moodId: formData.get('moodId'),
    storyId: formData.get('storyId'),
    promptId: formData.get('promptId'),
    aiOptIn: formData.get('aiOptIn'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const id = (formData.get('id') as string) || null;
  const supabase = await createClient();

  const row = {
    user_id: viewer.id,
    title: d.title || null,
    body: d.body,
    mood_id: d.moodId || null,
    story_id: d.storyId || null,
    prompt_id: d.promptId || null,
    // Explicit opt-in only. Absent checkbox means false, never "keep
    // whatever it was" — a reader unticking it must actually revoke.
    ai_opt_in: d.aiOptIn === 'on',
  };

  if (id) {
    // The RLS policy already restricts this to the author's own rows; the
    // eq() is belt as well as braces.
    const { error } = await supabase
      .from('journal_entries')
      .update(row)
      .eq('id', id)
      .eq('user_id', viewer.id);

    if (error) return { error: error.message };
    revalidatePath('/journal');
    return { message: 'Saved.', id };
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert(row)
    .select('id')
    .single();

  if (error) return { error: error.message };

  revalidatePath('/journal');
  return { message: 'Kept.', id: data.id };
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const viewer = await requireViewer('/journal');
  const id = formData.get('id') as string;
  if (!id) return;

  const supabase = await createClient();
  await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', viewer.id);

  revalidatePath('/journal');
}

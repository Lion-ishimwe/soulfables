'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import { requireViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { demoAddEntry, demoDeleteEntry } from '@/lib/demo/queries';
import { limitFor, HOUR, waitMessage } from '@/lib/rate-limit';

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

/**
 * An opaque reference to a mood, story or prompt.
 *
 * Deliberately not `z.string().uuid()`. The id's *shape* is a storage
 * detail — UUIDs in Postgres, readable slugs in demo mode — and baking
 * one shape into validation made the composer reject every entry that
 * had a mood attached. Whether the id resolves to anything is decided
 * where it is used, which is the only place that can actually know.
 */
const ref = z.string().trim().max(64).optional().or(z.literal(''));

const isUuid = (v: string | undefined) =>
  Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));

const WORD_LIMIT = 2000;
const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

const entrySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write something first — even one line.')
    .max(20000, 'That entry is longer than the journal can hold.')
    // The composer counts words and says 2,000; the server agrees, so
    // the number on screen is a rule and not a suggestion.
    .refine((t) => countWords(t) <= WORD_LIMIT, {
      message: `One quiet page is ${WORD_LIMIT.toLocaleString()} words. This one is longer.`,
    }),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  moodId: ref,
  storyId: ref,
  sectionId: ref,
  promptId: ref,
  /* A line worth remembering. Kept as a saved passage against the story,
     which is where the House keeps lines — not inside the entry. */
  quote: z.string().trim().max(2000).optional().or(z.literal('')),
  aiOptIn: z.boolean().default(false),
});

export async function saveEntry(
  _prev: JournalResult,
  formData: FormData,
): Promise<JournalResult> {
  const viewer = await requireViewer('/journal');

  const limit = await limitFor('journal', viewer.id, 60, HOUR);
  if (!limit.ok) return { error: waitMessage(limit) };

  const parsed = entrySchema.safeParse({
    body: field(formData, 'body'),
    title: field(formData, 'title'),
    moodId: field(formData, 'moodId'),
    storyId: field(formData, 'storyId'),
    sectionId: field(formData, 'sectionId'),
    promptId: field(formData, 'promptId'),
    quote: field(formData, 'quote'),
    aiOptIn: checkbox(formData, 'aiOptIn'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const id = field(formData, 'id') || null;

  /*
   * A connected story carries its two answers with it.
   *
   * The composer marks both as required and waits for them; this is the
   * same rule where it cannot be skipped. `hasSections` says whether the
   * story offered places to choose between at all — a story with no
   * headings has nowhere to point at, and is not asked.
   */
  if (d.storyId) {
    if (!d.quote) {
      return { error: 'Add the line you want to remember, or disconnect the story.' };
    }
    if (field(formData, 'hasSections') === '1' && !d.sectionId) {
      return { error: 'Choose where in the story this reflection belongs.' };
    }
  }

  // Demo mode writes to the in-process store. Same validation, same
  // return shape — the composer cannot tell the difference.
  if (isDemoMode()) {
    const newId = await demoAddEntry({
      title: d.title || null,
      body: d.body,
      moodId: d.moodId || null,
      storySlug: d.storyId ? d.storyId.replace(/^demo-/, '') : null,
      aiOptIn: d.aiOptIn,
    });
    revalidatePath('/journal');
    return { message: 'Kept.', id: newId };
  }

  const supabase = await createClient();

  const row = {
    user_id: viewer.id,
    title: d.title || null,
    body: d.body,
    // Columns are uuid; anything else is a demo id that has no meaning
    // here, so it is dropped rather than sent to Postgres to be rejected.
    mood_id: isUuid(d.moodId) ? d.moodId : null,
    story_id: isUuid(d.storyId) ? d.storyId : null,
    section_id: isUuid(d.sectionId) ? d.sectionId : null,
    prompt_id: isUuid(d.promptId) ? d.promptId : null,
    // Explicit opt-in only. Absent checkbox means false, never "keep
    // whatever it was" — a reader unticking it must actually revoke.
    ai_opt_in: d.aiOptIn,
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

  /*
   * The line to remember goes where lines live: saved_passages, against
   * the story. It needs a story — a passage belongs to one — so without a
   * story chosen the composer never offers the field. Failure here is
   * reported, not swallowed: the reflection is safe, and the reader
   * should know the line was not.
   */
  let kept = 'Kept.';
  if (d.quote && row.story_id) {
    const { error: passageError } = await supabase.from('saved_passages').insert({
      user_id: viewer.id,
      story_id: row.story_id,
      section_id: row.section_id,
      quote: d.quote,
    });
    if (passageError) {
      console.error('[journal] saved_passages', passageError.message);
      kept = 'Kept — but the line could not be saved to your library.';
    } else {
      revalidatePath('/account/library');
    }
  }

  revalidatePath('/journal');
  return { message: kept, id: data.id };
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const viewer = await requireViewer('/journal');
  const id = field(formData, 'id') ?? '';
  if (!id) return;

  if (isDemoMode()) {
    await demoDeleteEntry(id);
    revalidatePath('/journal');
    return;
  }

  const supabase = await createClient();
  await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', viewer.id);

  revalidatePath('/journal');
}

const editSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(200).optional().or(z.literal('')),
  body: z
    .string()
    .trim()
    .min(1, 'A reflection cannot be empty. Delete it instead, if it should go.')
    .max(20000, 'That entry is longer than the journal can hold.')
    .refine((t) => countWords(t) <= WORD_LIMIT, {
      message: `One quiet page is ${WORD_LIMIT.toLocaleString()} words. This one is longer.`,
    }),
});

/**
 * Change the words of a reflection.
 *
 * Only the title and the body: the date, the feeling, the story and the
 * section are what the reflection was about, and stay. Scoped to the
 * reader twice — the query says user_id, and RLS says it again.
 */
export async function updateEntry(
  _prev: JournalResult,
  formData: FormData,
): Promise<JournalResult> {
  const viewer = await requireViewer('/journal');

  const parsed = editSchema.safeParse({
    id: field(formData, 'id'),
    title: field(formData, 'title'),
    body: field(formData, 'body'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (isDemoMode()) {
    const { demoUpdateEntry } = await import('@/lib/demo/queries');
    await demoUpdateEntry(d.id, { title: d.title || null, body: d.body });
    revalidatePath('/journal');
    return { message: 'Changed.', id: d.id };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('journal_entries')
    .update({ title: d.title || null, body: d.body })
    .eq('id', d.id)
    .eq('user_id', viewer.id);

  if (error) return { error: error.message };

  revalidatePath('/journal');
  return { message: 'Changed.', id: d.id };
}

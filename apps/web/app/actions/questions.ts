'use server';

import type { Route } from 'next';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { field } from '@/lib/form';
import { getViewer, requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';
import { saveEntry, type JournalResult } from './journal';

/**
 * The drawer of quiet questions: what a reader does with a card, and
 * what the House's staff do to the cards.
 *
 * A reader's reflection goes through the journal's own save, so the
 * rules there — the word limit, the rate limit, privacy — are the rules
 * here. The only thing this file adds for readers is the answer to
 * "what if they are not signed in": say so, rather than bounce them to
 * a sign-in page with their words lost.
 */

export type KeepResult = JournalResult & { signIn?: boolean };

export async function keepReflection(_prev: KeepResult, formData: FormData): Promise<KeepResult> {
  const viewer = await getViewer();
  if (!viewer) return { signIn: true };
  return saveEntry({}, formData);
}

// ---------------------------------------------------------------------
// Staff: the cards themselves.
// ---------------------------------------------------------------------

export type CardResult = { error?: string; message?: string };

const cardSchema = z.object({
  title: z.string().trim().min(1, 'A card needs a name.').max(80),
  feeling: z.string().trim().min(1, 'Say which feeling the card belongs to.').max(40),
  whisper: z.string().trim().max(240).optional().or(z.literal('')),
  body: z.string().trim().min(1, 'The question is the card. Write it.').max(500),
  glyph: z.string().trim().max(8).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(999).catch(0),
});

const CARDS_PAGE = '/admin/settings/questions';

async function note(action: string, id: string, after: unknown) {
  try {
    const viewer = await requireStaff();
    const supabase = await createClient();
    await supabase.from('audit_log').insert({
      action,
      entity_type: 'journal_prompt',
      entity_id: id,
      actor_id: viewer.id,
      actor_email: viewer.email ?? null,
      after,
    });
  } catch (e) {
    console.error('[questions] audit not written', e instanceof Error ? e.message : e);
  }
}

function freshen() {
  revalidateTag('content');
  revalidatePath('/questions');
  revalidatePath(CARDS_PAGE);
}

export async function saveCard(_prev: CardResult, formData: FormData): Promise<CardResult> {
  await requireStaff();
  if (isDemoMode()) return { error: 'The demo keeps its cards as they are.' };

  const id = field(formData, 'id') || null;
  const parsed = cardSchema.safeParse({
    title: field(formData, 'title'),
    feeling: field(formData, 'feeling'),
    whisper: field(formData, 'whisper'),
    body: field(formData, 'body'),
    glyph: field(formData, 'glyph'),
    sortOrder: field(formData, 'sortOrder'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const row = {
    kind: 'deck',
    title: d.title,
    feeling: d.feeling,
    whisper: d.whisper || null,
    body: d.body,
    glyph: d.glyph || null,
    sort_order: d.sortOrder,
  };

  const res = id
    ? await supabase.from('journal_prompts').update(row).eq('id', id).eq('kind', 'deck').select('id').single()
    : await supabase.from('journal_prompts').insert(row).select('id').single();

  if (res.error) return { error: res.error.message };

  await note(id ? 'question.update' : 'question.create', res.data.id as string, { title: d.title, feeling: d.feeling });
  freshen();
  redirect(`${CARDS_PAGE}?saved=${encodeURIComponent(d.title)}` as Route);
}

/** Put a card away, or bring it back. A put-away card keeps its reflections and simply is not drawn. */
export async function setCardActive(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;

  const id = field(formData, 'id');
  const active = field(formData, 'active') === '1';
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_prompts')
    .update({ is_active: active })
    .eq('id', id)
    .eq('kind', 'deck')
    .select('title')
    .single();
  if (error) return;

  await note(active ? 'question.restore' : 'question.put_away', id, { title: data?.title });
  freshen();
  redirect(`${CARDS_PAGE}?${active ? 'back' : 'put'}=${encodeURIComponent((data?.title as string) ?? '')}` as Route);
}

/**
 * Remove a card for good. Refused once anyone has written to it: their
 * reflection would lose the question it answered. Put it away instead.
 */
export async function deleteCard(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;

  const id = field(formData, 'id');
  if (!id) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true })
    .eq('prompt_id', id);
  if ((count ?? 0) > 0) {
    redirect(`${CARDS_PAGE}?kept=1` as Route);
  }

  const { data } = await supabase
    .from('journal_prompts')
    .delete()
    .eq('id', id)
    .eq('kind', 'deck')
    .select('title')
    .single();

  await note('question.delete', id, { title: data?.title });
  freshen();
  redirect(`${CARDS_PAGE}?removed=${encodeURIComponent((data?.title as string) ?? '')}` as Route);
}

// ---------------------------------------------------------------------
// Staff: the affirmations.
// ---------------------------------------------------------------------

const affirmationSchema = z.object({
  body: z.string().trim().min(3, 'Write the line.').max(200),
});

export async function saveAffirmation(_prev: CardResult, formData: FormData): Promise<CardResult> {
  await requireStaff();
  if (isDemoMode()) return { error: 'The demo keeps its lines as they are.' };

  const parsed = affirmationSchema.safeParse({ body: field(formData, 'body') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { count } = await supabase.from('affirmations').select('id', { count: 'exact', head: true });
  const { data, error } = await supabase
    .from('affirmations')
    .insert({ body: parsed.data.body, sort_order: (count ?? 0) + 1 })
    .select('id')
    .single();
  if (error) return { error: error.message };

  await note('affirmation.create', data.id as string, { body: parsed.data.body });
  freshen();
  redirect(`${CARDS_PAGE}?line=added` as Route);
}

export async function setAffirmationActive(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;
  const id = field(formData, 'id');
  const active = field(formData, 'active') === '1';
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.from('affirmations').update({ is_active: active }).eq('id', id);
  if (error) return;
  await note(active ? 'affirmation.restore' : 'affirmation.put_away', id, {});
  freshen();
  redirect(`${CARDS_PAGE}?line=${active ? 'back' : 'put'}` as Route);
}

export async function deleteAffirmation(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;
  const id = field(formData, 'id');
  if (!id) return;
  const supabase = await createClient();
  await supabase.from('affirmations').delete().eq('id', id);
  await note('affirmation.delete', id, {});
  freshen();
  redirect(`${CARDS_PAGE}?line=removed` as Route);
}

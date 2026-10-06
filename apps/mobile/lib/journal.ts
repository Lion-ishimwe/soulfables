import { supabase } from './supabase';

/**
 * The reading journal and the drawer of quiet questions.
 *
 * Entries are the reader's own: the row policy lets a reader see and
 * write only theirs, so these calls carry no user filter beyond the
 * session. A prompt is the question of the day; a card is one of the
 * deck a reader draws from on the Reflection Deck page.
 */

export type Mood = { id: string; slug: string; label: string; emoji: string | null };
export type Prompt = { id: string; body: string };
export type Card = { id: string; title: string; feeling: string; whisper: string | null; body: string; glyph: string | null };
export type Entry = {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  mood: { label: string; emoji: string | null } | null;
  story: { slug: string; title: string } | null;
};
export type Affirmation = { id: string; body: string };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function getMoods(): Promise<Mood[]> {
  const { data } = await supabase.from('moods').select('id, slug, label, emoji').eq('is_active', true).order('sort_order');
  return (data ?? []) as Mood[];
}

/** Today's scheduled prompt, or one from the pool chosen by the date. */
export async function getTodaysPrompt(): Promise<Prompt | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: scheduled } = await supabase.from('journal_prompts').select('id, body').eq('is_active', true).eq('scheduled_on', today).limit(1).maybeSingle();
  if (scheduled) return scheduled as Prompt;
  const { data: pool } = await supabase.from('journal_prompts').select('id, body').eq('is_active', true).neq('kind', 'deck').is('scheduled_on', null).order('created_at');
  const list = (pool ?? []) as Prompt[];
  if (!list.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  return list[day % list.length];
}

export async function getAffirmation(): Promise<Affirmation | null> {
  const { data } = await supabase.from('affirmations').select('id, body').eq('is_active', true).order('sort_order');
  const list = (data ?? []) as Affirmation[];
  if (!list.length) return null;
  const day = Math.floor(Date.now() / 86_400_000);
  return list[day % list.length];
}

export async function listEntries(limit = 30): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, body, created_at, moods(label, emoji), stories(slug, title)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? null,
    body: r.body as string,
    createdAt: r.created_at as string,
    mood: one(r.moods as { label: string; emoji: string | null } | null),
    story: one(r.stories as { slug: string; title: string } | null),
  }));
}

export async function saveEntry(input: {
  userId: string;
  body: string;
  title?: string | null;
  moodId?: string | null;
  storyId?: string | null;
  promptId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('journal_entries').insert({
    user_id: input.userId,
    body: input.body,
    title: input.title || null,
    mood_id: input.moodId || null,
    story_id: input.storyId || null,
    prompt_id: input.promptId || null,
    visibility: 'private',
  });
  if (error) throw new Error(error.message);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('journal_entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** The deck, in the House's order; the screen shuffles. */
export async function getCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('journal_prompts')
    .select('id, title, feeling, whisper, body, glyph')
    .eq('kind', 'deck')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? '',
    feeling: (r.feeling as string) ?? '',
    whisper: (r.whisper as string) ?? null,
    body: r.body as string,
    glyph: (r.glyph as string) ?? null,
  }));
}

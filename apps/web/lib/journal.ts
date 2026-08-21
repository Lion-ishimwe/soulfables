import 'server-only';
import { createClient } from './supabase/server';

/** Reads for the Reading Room. RLS scopes every one of these to its author. */

export type Mood = {
  id: string;
  slug: string;
  label: string;
  emoji: string | null;
  shelfSlug: string | null;
};

export type Prompt = { id: string; body: string };

export type Entry = {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  moodLabel: string | null;
  moodEmoji: string | null;
  storySlug: string | null;
  storyTitle: string | null;
};

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/** Fallback moods so the Reading Room renders before the database exists. */
const FALLBACK_MOODS: Mood[] = [
  { id: 'm1', slug: 'heartbroken', label: 'Heartbroken', emoji: '❤️', shelfSlug: 'heartbreak' },
  { id: 'm2', slug: 'healing', label: 'Healing', emoji: '🌿', shelfSlug: 'healing' },
  { id: 'm3', slug: 'lost', label: 'Lost', emoji: '🌙', shelfSlug: 'anxiety' },
  { id: 'm4', slug: 'grieving', label: 'Grieving', emoji: '🕊️', shelfSlug: 'grief' },
  { id: 'm5', slug: 'hopeful', label: 'Hopeful', emoji: '✨', shelfSlug: 'hope' },
  { id: 'm6', slug: 'unsure', label: 'Unsure', emoji: '🪞', shelfSlug: null },
];

const FALLBACK_PROMPTS = [
  'What part of yourself are you making peace with?',
  'What is the smallest thing that mends a hole in a heart?',
  'Who are you still writing letters to in your head?',
  'What did today ask of you that yesterday could not?',
  'What are you carrying that was never yours to hold?',
];

export async function getMoods(): Promise<Mood[]> {
  if (!configured()) return FALLBACK_MOODS;

  const supabase = await createClient();
  const { data } = await supabase
    .from('moods')
    .select('id, slug, label, emoji, shelves(slug)')
    .eq('is_active', true)
    .order('sort_order');

  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    slug: m.slug as string,
    label: m.label as string,
    emoji: (m.emoji as string) ?? null,
    shelfSlug: (m.shelves as { slug?: string } | null)?.slug ?? null,
  }));
}

/**
 * Today's question.
 *
 * A prompt scheduled for today wins. Otherwise one is drawn from the pool,
 * chosen by the date rather than at random — so the question is the same
 * all day for everyone, and changes at midnight. A prompt that flickered
 * on every page load would not feel like being asked something.
 */
export async function getTodaysPrompt(): Promise<Prompt | null> {
  const today = new Date();
  const dayIndex = Math.floor(today.getTime() / 86_400_000);

  if (!configured()) {
    const body = FALLBACK_PROMPTS[dayIndex % FALLBACK_PROMPTS.length];
    return { id: 'fallback', body };
  }

  const supabase = await createClient();
  const iso = today.toISOString().slice(0, 10);

  const { data: scheduled } = await supabase
    .from('journal_prompts')
    .select('id, body')
    .eq('scheduled_on', iso)
    .eq('is_active', true)
    .maybeSingle();

  if (scheduled) return { id: scheduled.id, body: scheduled.body };

  const { data: pool } = await supabase
    .from('journal_prompts')
    .select('id, body')
    .is('scheduled_on', null)
    .eq('is_active', true)
    .eq('kind', 'daily')
    .order('created_at');

  if (!pool || pool.length === 0) return null;

  const pick = pool[dayIndex % pool.length];
  return { id: pick.id, body: pick.body };
}

export async function getEntries(limit = 30): Promise<Entry[]> {
  if (!configured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, body, created_at, moods(label, emoji), stories(slug, title)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[journal] getEntries', error.message);
    return [];
  }

  return (data ?? []).map((e: Record<string, unknown>) => {
    const mood = e.moods as { label?: string; emoji?: string } | null;
    const story = e.stories as { slug?: string; title?: string } | null;
    return {
      id: e.id as string,
      title: (e.title as string) ?? null,
      body: e.body as string,
      createdAt: e.created_at as string,
      moodLabel: mood?.label ?? null,
      moodEmoji: mood?.emoji ?? null,
      storySlug: story?.slug ?? null,
      storyTitle: story?.title ?? null,
    };
  });
}

/** Private full-text search over the reader's own entries. */
export async function searchEntries(query: string): Promise<Entry[]> {
  if (!configured() || !query.trim()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('journal_entries')
    .select('id, title, body, created_at, moods(label, emoji), stories(slug, title)')
    .textSearch('search_vector', query.trim(), {
      type: 'websearch',
      config: 'english',
    })
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((e: Record<string, unknown>) => {
    const mood = e.moods as { label?: string; emoji?: string } | null;
    const story = e.stories as { slug?: string; title?: string } | null;
    return {
      id: e.id as string,
      title: (e.title as string) ?? null,
      body: e.body as string,
      createdAt: e.created_at as string,
      moodLabel: mood?.label ?? null,
      moodEmoji: mood?.emoji ?? null,
      storySlug: story?.slug ?? null,
      storyTitle: story?.title ?? null,
    };
  });
}

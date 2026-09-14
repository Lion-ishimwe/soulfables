import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { DEMO_MOODS, demoEntries, demoSearchEntries } from './demo/queries';
import { getStories } from './content';

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
  /** Where in the story, when the entry was pinned to a section. */
  sectionTitle: string | null;
};

/** A section a reflection can be pinned to. Only some stories have them. */
export type SectionOption = { id: string; storyId: string; title: string };

const configured = () => !isDemoMode();

const FALLBACK_PROMPTS = [
  'What part of yourself are you making peace with?',
  'What is the smallest thing that mends a hole in a heart?',
  'Who are you still writing letters to in your head?',
  'What did today ask of you that yesterday could not?',
  'What are you carrying that was never yours to hold?',
];

export async function getMoods(): Promise<Mood[]> {
  if (!configured()) return DEMO_MOODS;

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
export async function getTodaysPrompt(offset = 0): Promise<Prompt | null> {
  const today = new Date();
  const dayIndex = Math.floor(today.getTime() / 86_400_000) + offset;

  if (!configured()) {
    const body = FALLBACK_PROMPTS[dayIndex % FALLBACK_PROMPTS.length];
    return { id: 'fallback', body };
  }

  const supabase = await createClient();
  const iso = today.toISOString().slice(0, 10);

  /*
   * "Another question" is a link carrying an offset, not a client-side
   * shuffle: the page stays server-rendered, the question is reachable
   * by URL, and it works before any JavaScript has loaded. A scheduled
   * prompt is only the first answer — asking for another steps into the
   * pool.
   */
  if (offset === 0) {
    const { data: scheduled } = await supabase
      .from('journal_prompts')
      .select('id, body')
      .eq('scheduled_on', iso)
      .eq('is_active', true)
      .maybeSingle();

    if (scheduled) return { id: scheduled.id, body: scheduled.body };
  }

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

/** Titles for story-linked entries, resolved once per call. */
async function storyTitleLookup() {
  const stories = await getStories();
  return (slug: string) => stories.find((s) => s.slug === slug)?.title ?? null;
}

export async function getEntries(limit = 30): Promise<Entry[]> {
  if (!configured()) {
    return (await demoEntries(await storyTitleLookup())).slice(0, limit);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, body, created_at, moods(label, emoji), stories(slug, title), story_sections(title)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[journal] getEntries', error.message);
    return [];
  }

  return (data ?? []).map((e: Record<string, unknown>) => {
    const mood = e.moods as { label?: string; emoji?: string } | null;
    const story = e.stories as { slug?: string; title?: string } | null;
    const section = e.story_sections as { title?: string } | null;
    return {
      id: e.id as string,
      title: (e.title as string) ?? null,
      body: e.body as string,
      createdAt: e.created_at as string,
      moodLabel: mood?.label ?? null,
      moodEmoji: mood?.emoji ?? null,
      storySlug: story?.slug ?? null,
      storyTitle: story?.title ?? null,
      sectionTitle: section?.title ?? null,
    };
  });
}

/** Private full-text search over the reader's own entries. */
export async function searchEntries(query: string): Promise<Entry[]> {
  if (!query.trim()) return [];
  if (!configured()) {
    return demoSearchEntries(query, await storyTitleLookup());
  }

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
      sectionTitle: null,
    };
  });
}

/**
 * How many reflections the reader has kept, in total.
 *
 * Null rather than zero when the count cannot be read: a refused query
 * and an empty journal are different answers, and "0 reflections" over a
 * journal that has twelve is the kind of lie a header should not tell.
 */
export async function countEntries(): Promise<number | null> {
  if (!configured()) return (await getEntries(1000)).length;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('journal_entries')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('[journal] countEntries', error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * The sections of the stories a reflection could be pinned to.
 *
 * Fetched for the reader's whole shelf at once — a few stories, a
 * handful of sections each — so the composer can switch the "where in
 * the story" list without a round trip when a different story is chosen.
 */
export async function getSectionsFor(storyIds: string[]): Promise<SectionOption[]> {
  if (!configured() || storyIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('story_sections')
    .select('id, story_id, title, position')
    .in('story_id', storyIds)
    .order('position');

  if (error) {
    console.error('[journal] getSectionsFor', error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    storyId: r.story_id as string,
    title: (r.title as string) ?? '',
  }));
}

/**
 * The reader's own reflections on one story, newest first.
 *
 * Shown at the foot of the story so that rereading it a month later
 * puts your own words beside it. RLS scopes the read to the reader; a
 * stranger gets nothing, and a signed-in reader gets only theirs.
 */
export async function getEntriesForStory(
  story: { id?: string | null; slug: string },
  limit = 3,
): Promise<Entry[]> {
  if (!configured()) {
    const all = await demoEntries(await storyTitleLookup());
    return all.filter((e) => e.storySlug === story.slug).slice(0, limit);
  }
  if (!story.id) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, title, body, created_at, moods(label, emoji), stories(slug, title), story_sections(title)')
    .eq('story_id', story.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[journal] getEntriesForStory', error.message);
    return [];
  }

  return (data ?? []).map((e: Record<string, unknown>) => {
    const mood = e.moods as { label?: string; emoji?: string } | null;
    const st = e.stories as { slug?: string; title?: string } | null;
    const section = e.story_sections as { title?: string } | null;
    return {
      id: e.id as string,
      title: (e.title as string) ?? null,
      body: e.body as string,
      createdAt: e.created_at as string,
      moodLabel: mood?.label ?? null,
      moodEmoji: mood?.emoji ?? null,
      storySlug: st?.slug ?? null,
      storyTitle: st?.title ?? null,
      sectionTitle: section?.title ?? null,
    };
  });
}

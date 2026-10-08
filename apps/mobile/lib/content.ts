import { supabase } from './supabase';

/**
 * Stories, shelves, series and search, read the way the website reads them.
 *
 * Lists come straight from the tables under row-level security: only
 * published stories, only the columns the public may see. A single
 * story comes through story_for_reader, the same function the story
 * page calls, which decides whether this reader may have the body and
 * the narration, and says why not when not.
 */

export type StoryCard = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  author: string | null;
  readingMinutes: number;
  coverImage: string | null;
  access: 'free' | 'premium' | 'paid';
  forSleep: boolean;
  hasAudio: boolean;
  shelf: { slug: string; title: string } | null;
  series: { slug: string; title: string } | null;
  publishedAt: string | null;
};

export type Shelf = { id: string; slug: string; label: string; emoji: string | null; tagline: string | null };
export type Series = { id: string; slug: string; title: string; description: string | null; coverImage: string | null };

export type AudioReason = 'premium' | 'sign_in' | 'allowance' | 'paid' | null;

export type FullStory = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  readingMinutes: number;
  coverImage: string | null;
  access: 'free' | 'premium' | 'paid';
  author: string | null;
  shelf: string | null;
  locked: boolean;
  owned: boolean;
  body: string | null;
  product: { slug: string; unitAmount: number; currency: string } | null;
  audio: {
    narrator: string | null;
    durationSeconds: number | null;
    locked: boolean;
    reason: AudioReason;
    listensLeft: number;
  } | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const CARD_SELECT =
  'id, slug, title, subtitle, excerpt, reading_minutes, cover_image, access, for_sleep, published_at, authors!stories_author_id_fkey(name), story_audio(id), series(slug, title), story_shelves(is_primary, shelves(slug, label))';

function toCard(r: Record<string, unknown>): StoryCard {
  const links = (r.story_shelves as { is_primary: boolean; shelves: { slug: string; label: string } | { slug: string; label: string }[] | null }[] | null) ?? [];
  const primary = links.find((l) => l.is_primary) ?? links[0];
  const sh = primary ? one(primary.shelves) : null;
  const author = one(r.authors as { name: string } | { name: string }[] | null);
  const series = one(r.series as { slug: string; title: string } | { slug: string; title: string }[] | null);
  const audio = (r.story_audio as unknown[] | null) ?? [];
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? null,
    excerpt: (r.excerpt as string) ?? null,
    author: author?.name ?? null,
    readingMinutes: Number(r.reading_minutes ?? 0),
    coverImage: (r.cover_image as string) ?? null,
    access: (r.access as StoryCard['access']) ?? 'free',
    forSleep: Boolean(r.for_sleep),
    hasAudio: audio.length > 0,
    shelf: sh ? { slug: sh.slug, title: sh.label } : null,
    series: series ? { slug: series.slug, title: series.title.replace(/^#\s*/, '') } : null,
    publishedAt: (r.published_at as string) ?? null,
  };
}

export async function listShelves(): Promise<Shelf[]> {
  const { data, error } = await supabase.from('shelves').select('id, slug, label, emoji, tagline').eq('status', 'published').order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as Shelf[];
}

export async function listSeries(): Promise<Series[]> {
  const { data } = await supabase.from('series').select('id, slug, title, description, cover_image').eq('status', 'published').order('title');
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: String(r.title).replace(/^#\s*/, ''),
    description: (r.description as string) ?? null,
    coverImage: (r.cover_image as string) ?? null,
  }));
}

export async function listStories(): Promise<StoryCard[]> {
  const { data, error } = await supabase.from('stories').select(CARD_SELECT).eq('status', 'published').order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(toCard);
}

/**
 * Free to read, as the Library means it: not kept for Premium and not
 * sold as a book. Everything else stands in the Bookshop.
 */
export const isFreeToRead = (s: StoryCard): boolean => s.access === 'free';

/** The Library's list: the free stories only. */
export async function listLibraryStories(): Promise<StoryCard[]> {
  return (await listStories()).filter(isFreeToRead);
}

/** The Bookshop's list: what the Library does not hold. */
export async function listShopStories(): Promise<StoryCard[]> {
  return (await listStories()).filter((s) => !isFreeToRead(s));
}

export async function getStoryCard(id: string): Promise<StoryCard | null> {
  const { data } = await supabase.from('stories').select(CARD_SELECT).eq('id', id).eq('status', 'published').maybeSingle();
  return data ? toCard(data as Record<string, unknown>) : null;
}

/**
 * The story of the day: what the House has placed in the home hero
 * slot, the same slot the website's front page reads. When nothing is
 * placed, the date picks one from the shelves so every day has a story.
 */
export async function getStoryOfTheDay(all?: StoryCard[]): Promise<StoryCard | null> {
  const { data: slot } = await supabase
    .from('featured_slots')
    .select('entity_id, headline, blurb, starts_at, ends_at')
    .eq('placement', 'home_hero')
    .eq('entity_type', 'story')
    .order('sort_order')
    .limit(5);
  const now = Date.now();
  const live = ((slot ?? []) as { entity_id: string; starts_at: string; ends_at: string | null }[]).find(
    (s) => new Date(s.starts_at).getTime() <= now && (!s.ends_at || new Date(s.ends_at).getTime() > now),
  );
  if (live) {
    const card = await getStoryCard(live.entity_id);
    if (card) return card;
  }
  const list = (all ?? (await listStories())).filter(isFreeToRead);
  if (!list.length) return null;
  const day = Math.floor(now / 86_400_000);
  return list[day % list.length];
}

/** Full-text search, the same function the site's search page calls. */
export async function searchStories(query: string): Promise<StoryCard[]> {
  const { data, error } = await supabase.rpc('search_stories', { p_query: query, p_limit: 30 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? null,
    excerpt: null,
    author: (r.author_name as string) ?? null,
    readingMinutes: Number(r.reading_minutes ?? 0),
    coverImage: (r.cover_image as string) ?? null,
    access: (r.access as StoryCard['access']) ?? 'free',
    forSleep: false,
    hasAudio: Boolean(r.has_audio),
    shelf: r.shelf_slug ? { slug: r.shelf_slug as string, title: String(r.shelf_slug).replace(/-/g, ' ') } : null,
    series: null,
    publishedAt: null,
  }));
}

export async function getStory(slug: string): Promise<FullStory | null> {
  const { data, error } = await supabase.rpc('story_for_reader', { p_slug: slug });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const s = data as Record<string, unknown>;
  const audio = s.audio as Record<string, unknown> | null;
  const product = s.product as Record<string, unknown> | null;
  return {
    id: s.id as string,
    slug: s.slug as string,
    title: s.title as string,
    subtitle: (s.subtitle as string) ?? null,
    readingMinutes: Number(s.reading_minutes ?? 0),
    coverImage: (s.cover_image as string) ?? null,
    access: (s.access as FullStory['access']) ?? 'free',
    author: (s.author as string) ?? null,
    shelf: (s.shelf as string) ?? null,
    locked: Boolean(s.locked),
    owned: Boolean(s.owned),
    body: (s.body as string) ?? null,
    product: product ? { slug: product.slug as string, unitAmount: Number(product.unit_amount ?? 0), currency: (product.currency as string) ?? 'USD' } : null,
    audio: audio
      ? {
          narrator: (audio.narrator as string) ?? null,
          durationSeconds: audio.duration_seconds == null ? null : Number(audio.duration_seconds),
          locked: Boolean(audio.locked),
          reason: (audio.reason as AudioReason) ?? null,
          listensLeft: Number(audio.listens_left ?? 0),
        }
      : null,
  };
}

// ---------------------------------------------------------------------
// The reader's own marks on a story
// ---------------------------------------------------------------------

export async function savedIds(): Promise<Set<string>> {
  const { data } = await supabase.from('saved_stories').select('story_id');
  return new Set(((data ?? []) as { story_id: string }[]).map((r) => r.story_id));
}

export async function isSaved(storyId: string, userId: string): Promise<boolean> {
  const { count } = await supabase.from('saved_stories').select('story_id', { count: 'exact', head: true }).eq('story_id', storyId).eq('user_id', userId);
  return (count ?? 0) > 0;
}

export async function setSaved(storyId: string, userId: string, saved: boolean): Promise<void> {
  if (saved) {
    const { error } = await supabase.from('saved_stories').upsert({ story_id: storyId, user_id: userId }, { onConflict: 'user_id,story_id' });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('saved_stories').delete().eq('story_id', storyId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

/** How far the reader got, as a fraction, kept the way the website keeps it. */
export async function markProgress(storyId: string, userId: string, percent: number): Promise<void> {
  const now = new Date().toISOString();
  const done = percent >= 0.98;
  const { error } = await supabase.from('reading_progress').upsert(
    { story_id: storyId, user_id: userId, percent: Math.max(0, Math.min(1, percent)), last_read_at: now, ...(done ? { completed_at: now } : {}) },
    { onConflict: 'user_id,story_id' },
  );
  if (error) throw new Error(error.message);
}

/** Story ids this reader has finished, to leave them out of a recommendation. */
export async function finishedIds(): Promise<Set<string>> {
  const { data } = await supabase.from('reading_progress').select('story_id').not('completed_at', 'is', null);
  return new Set(((data ?? []) as { story_id: string }[]).map((r) => r.story_id));
}

// ---------------------------------------------------------------------
// The weekly letter, as published on the site
// ---------------------------------------------------------------------

export type LetterCard = { slug: string; title: string; dek: string | null; publishedAt: string | null };

export async function latestLetter(): Promise<LetterCard | null> {
  const { data } = await supabase.from('letters').select('slug, title, dek, published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return { slug: r.slug as string, title: r.title as string, dek: (r.dek as string) ?? null, publishedAt: (r.published_at as string) ?? null };
}

import { supabase } from './supabase';

/**
 * Stories, shelves and search, read the way the website reads them.
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
  readingMinutes: number;
  coverImage: string | null;
  access: 'free' | 'premium' | 'paid';
  forSleep: boolean;
  shelf: { slug: string; title: string } | null;
  publishedAt: string | null;
};

export type Shelf = { id: string; slug: string; label: string; emoji: string | null; tagline: string | null };

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

export async function listShelves(): Promise<Shelf[]> {
  const { data, error } = await supabase
    .from('shelves')
    .select('id, slug, label, emoji, tagline')
    .eq('status', 'published')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as Shelf[];
}

export async function listStories(): Promise<StoryCard[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, slug, title, subtitle, reading_minutes, cover_image, access, for_sleep, published_at, story_shelves(is_primary, shelves(slug, label))')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const links = (row.story_shelves as { is_primary: boolean; shelves: { slug: string; label: string } | { slug: string; label: string }[] | null }[] | null) ?? [];
    const primary = links.find((l) => l.is_primary) ?? links[0];
    const sh = primary ? (Array.isArray(primary.shelves) ? primary.shelves[0] : primary.shelves) : null;
    return {
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      subtitle: (row.subtitle as string) ?? null,
      readingMinutes: Number(row.reading_minutes ?? 0),
      coverImage: (row.cover_image as string) ?? null,
      access: (row.access as StoryCard['access']) ?? 'free',
      forSleep: Boolean(row.for_sleep),
      shelf: sh ? { slug: sh.slug, title: sh.label } : null,
      publishedAt: (row.published_at as string) ?? null,
    };
  });
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
    readingMinutes: Number(r.reading_minutes ?? 0),
    coverImage: (r.cover_image as string) ?? null,
    access: (r.access as StoryCard['access']) ?? 'free',
    forSleep: false,
    shelf: r.shelf_slug ? { slug: r.shelf_slug as string, title: String(r.shelf_slug).replace(/-/g, ' ') } : null,
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

/** Opened, or finished. The site counts a finish as a read. */
export async function markProgress(storyId: string, userId: string, done: boolean): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('reading_progress').upsert(
    { story_id: storyId, user_id: userId, percent: done ? 1 : 0, last_read_at: now, ...(done ? { completed_at: now } : {}) },
    { onConflict: 'user_id,story_id' },
  );
  if (error) throw new Error(error.message);
}

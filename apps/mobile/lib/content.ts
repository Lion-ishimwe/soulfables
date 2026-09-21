import { supabase } from './supabase';

/**
 * Stories, read the way the website reads them.
 *
 * The list comes straight from the stories table under row-level
 * security: only published stories, only the columns the public may
 * see. A single story comes through story_for_reader, the same function
 * the story page calls, which decides whether this reader may have the
 * body and the narration, and says why not when not.
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

export async function listStories(): Promise<StoryCard[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, slug, title, subtitle, reading_minutes, cover_image, access, for_sleep, published_at, story_shelves(is_primary, shelves(slug, title))')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const links = (row.story_shelves as { is_primary: boolean; shelves: { slug: string; title: string } | null }[] | null) ?? [];
    const primary = links.find((l) => l.is_primary)?.shelves ?? links[0]?.shelves ?? null;
    return {
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      subtitle: (row.subtitle as string) ?? null,
      readingMinutes: Number(row.reading_minutes ?? 0),
      coverImage: (row.cover_image as string) ?? null,
      access: (row.access as StoryCard['access']) ?? 'free',
      forSleep: Boolean(row.for_sleep),
      shelf: primary,
      publishedAt: (row.published_at as string) ?? null,
    };
  });
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

/**
 * The story body is Markdown where a line beginning "::" opens a new
 * section. The reader shows sections with a small heading each; the
 * rest is paragraphs. Enough for a first version; a Markdown renderer
 * can replace this without changing the data.
 */
export function splitSections(body: string): { heading: string | null; paragraphs: string[] }[] {
  const out: { heading: string | null; paragraphs: string[] }[] = [];
  let current = { heading: null as string | null, paragraphs: [] as string[] };
  for (const block of body.split(/\n{2,}/)) {
    const line = block.trim();
    if (!line) continue;
    if (line.startsWith('::')) {
      if (current.paragraphs.length || current.heading) out.push(current);
      current = { heading: line.replace(/^::\s*/, ''), paragraphs: [] };
    } else {
      current.paragraphs.push(line.replace(/^>\s?/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1'));
    }
  }
  if (current.paragraphs.length || current.heading) out.push(current);
  return out;
}

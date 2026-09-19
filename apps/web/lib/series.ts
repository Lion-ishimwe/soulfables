import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';
import { getStories, type StoryCard } from './content';

/**
 * Series: stories that belong together, read in order.
 *
 * A series can be exclusive to Premium as a whole. Its episodes are
 * ordinary stories carrying series_id and episode_number; the story
 * page applies the series' access as if it were the story's own, and
 * the listings show the badge.
 */

export type Series = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  access: 'free' | 'premium';
  status: string;
  sortOrder: number;
  episodes: number;
};

async function fetchSeriesList(): Promise<Series[]> {
  if (isDemoMode()) return [];
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('series')
    .select('id, slug, title, description, cover_image, access, status, sort_order, stories(id)')
    .eq('status', 'published')
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[series] list', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    coverImage: (r.cover_image as string) ?? null,
    access: (r.access as 'free' | 'premium') ?? 'free',
    status: r.status as string,
    sortOrder: Number(r.sort_order ?? 0),
    episodes: ((r.stories as unknown[]) ?? []).length,
  }));
}

export const getSeriesList = unstable_cache(fetchSeriesList, ['series'], { revalidate: 60, tags: ['content'] });

/** One series and its published episodes, in order. */
export async function getSeries(slug: string): Promise<(Series & { stories: StoryCard[] }) | null> {
  const all = await getSeriesList();
  const series = all.find((s) => s.slug === slug);
  if (!series) return null;
  const stories = (await getStories())
    .filter((s) => s.series?.slug === slug)
    .sort((a, b) => (a.series?.episode ?? 0) - (b.series?.episode ?? 0));
  return { ...series, stories };
}

/** Every series, published or not. Staff only. */
export async function listAdminSeries(): Promise<Series[]> {
  if (isDemoMode()) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('series')
    .select('id, slug, title, description, cover_image, access, status, sort_order, stories(id)')
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[series] admin list', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    coverImage: (r.cover_image as string) ?? null,
    access: (r.access as 'free' | 'premium') ?? 'free',
    status: r.status as string,
    sortOrder: Number(r.sort_order ?? 0),
    episodes: ((r.stories as unknown[]) ?? []).length,
  }));
}

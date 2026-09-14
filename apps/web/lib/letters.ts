import 'server-only';
import { isDemoMode } from './demo/mode';

export type PublishedLetter = {
  slug: string;
  volume: number;
  number: number;
  title: string;
  dek: string | null;
  publishedAt: string | null;
};

/** The letters already sent, newest first. Public, like a published story. */
export async function getPublishedLetters(): Promise<PublishedLetter[]> {
  if (isDemoMode()) return [];
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('letters')
    .select('slug, volume, number, title, dek, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(52);
  if (error) {
    console.error('[letters] getPublishedLetters', error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    slug: r.slug as string,
    volume: Number(r.volume ?? 1),
    number: Number(r.number ?? 0),
    title: r.title as string,
    dek: (r.dek as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
  }));
}

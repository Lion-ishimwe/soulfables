import { supabase } from './supabase';

/**
 * What the reader owns and where they stand.
 *
 * Standing comes from reader_standing(), the function every story page
 * asks: staff, Premium, signed in, and how many free listens are used.
 * Owned books are the reader's entitlements with their product and its
 * files; a story sold as a book carries the story to open instead.
 */

export type Standing = { staff: boolean; premium: boolean; signedIn: boolean; listens: number; allowance: number };

export type Owned = {
  productId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverImage: string | null;
  grantedAt: string;
  files: { id: string; format: string; sizeBytes: number | null }[];
  stories: { slug: string; title: string }[];
};

export async function getStanding(): Promise<Standing> {
  const { data, error } = await supabase.rpc('reader_standing');
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    staff: Boolean(row?.staff),
    premium: Boolean(row?.premium),
    signedIn: Boolean(row?.signed_in),
    listens: Number(row?.listens ?? 0),
    allowance: Number(row?.allowance ?? 5),
  };
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function listOwned(): Promise<Owned[]> {
  const { data, error } = await supabase
    .from('entitlements')
    .select('product_id, granted_at, revoked_at, expires_at, products(slug, title, subtitle, cover_image, product_files(id, format, file_size_bytes, is_active), product_stories(stories(slug, title)))')
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });
  if (error) throw new Error(error.message);
  const out: Owned[] = [];
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    if (r.expires_at && new Date(r.expires_at as string).getTime() < Date.now()) continue;
    const p = one(r.products as Record<string, unknown> | Record<string, unknown>[] | null);
    if (!p) continue;
    out.push({
      productId: r.product_id as string,
      slug: p.slug as string,
      title: p.title as string,
      subtitle: (p.subtitle as string) ?? null,
      coverImage: (p.cover_image as string) ?? null,
      grantedAt: r.granted_at as string,
      files: (((p.product_files as { id: string; format: string; file_size_bytes: number | null; is_active: boolean }[]) ?? []).filter((f) => f.is_active)).map((f) => ({ id: f.id, format: String(f.format).toUpperCase(), sizeBytes: f.file_size_bytes })),
      stories: (((p.product_stories as { stories: { slug: string; title: string } | { slug: string; title: string }[] | null }[]) ?? []).map((l) => one(l.stories)).filter(Boolean) as { slug: string; title: string }[]),
    });
  }
  return out;
}

export type SavedStory = { slug: string; title: string; subtitle: string | null; readingMinutes: number; savedAt: string };

export async function listSaved(): Promise<SavedStory[]> {
  const { data } = await supabase.from('saved_stories').select('saved_at, stories(slug, title, subtitle, reading_minutes)').order('saved_at', { ascending: false });
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const s = one(r.stories as Record<string, unknown> | Record<string, unknown>[] | null);
      return s ? { slug: s.slug as string, title: s.title as string, subtitle: (s.subtitle as string) ?? null, readingMinutes: Number(s.reading_minutes ?? 0), savedAt: r.saved_at as string } : null;
    })
    .filter(Boolean) as SavedStory[];
}

export type ReadingRow = { slug: string; title: string; percent: number; lastReadAt: string; completedAt: string | null };

export async function listReading(): Promise<ReadingRow[]> {
  const { data } = await supabase.from('reading_progress').select('percent, last_read_at, completed_at, stories(slug, title)').order('last_read_at', { ascending: false }).limit(20);
  return ((data ?? []) as Record<string, unknown>[])
    .map((r) => {
      const s = one(r.stories as Record<string, unknown> | Record<string, unknown>[] | null);
      return s ? { slug: s.slug as string, title: s.title as string, percent: Number(r.percent ?? 0), lastReadAt: r.last_read_at as string, completedAt: (r.completed_at as string) ?? null } : null;
    })
    .filter(Boolean) as ReadingRow[];
}

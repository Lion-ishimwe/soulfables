import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { demoOwnedProducts, demoReading, demoSavedSlugs } from './demo/queries';
import { getStories, getProducts } from './content';

/**
 * A reader's own shelf.
 *
 * Every query here runs through the request-scoped client, so RLS scopes
 * it to the signed-in reader automatically. There is no `where user_id =`
 * in this file and there should not be — relying on the database rather
 * than on remembering to add a filter is the whole point.
 */

export type OwnedProduct = {
  productId: string;
  slug: string;
  title: string;
  subtitle: string | null;
  coverImage: string | null;
  source: string;
  grantedAt: string;
  files: { id: string; format: string; sizeBytes: number | null }[];
};

export type ReadingRow = {
  slug: string;
  title: string;
  subtitle: string | null;
  percent: number;
  readingMinutes: number | null;
  lastReadAt: string;
  completedAt: string | null;
};

export async function getOwnedProducts(): Promise<OwnedProduct[]> {
  if (isDemoMode()) {
    const products = await getProducts();
    return demoOwnedProducts(
      (slug) => products.find((p) => p.slug === slug) ?? null,
    );
  }
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('entitlements')
    .select(
      'product_id, source, granted_at, products(slug, title, subtitle, cover_image, product_files(id, format, file_size_bytes, is_active))',
    )
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });

  if (error) {
    console.error('[library] getOwnedProducts', error.message);
    return [];
  }

  return (data ?? [])
    .map((row: Record<string, unknown>) => {
      const p = row.products as Record<string, unknown> | null;
      if (!p) return null;

      const files = ((p.product_files as {
        id: string;
        format: string;
        file_size_bytes: number | null;
        is_active: boolean;
      }[]) ?? [])
        .filter((f) => f.is_active)
        .map((f) => ({
          id: f.id,
          format: f.format.toUpperCase(),
          sizeBytes: f.file_size_bytes,
        }));

      return {
        productId: row.product_id as string,
        slug: p.slug as string,
        title: p.title as string,
        subtitle: (p.subtitle as string) ?? null,
        coverImage: (p.cover_image as string) ?? null,
        source: row.source as string,
        grantedAt: row.granted_at as string,
        files,
      };
    })
    .filter(Boolean) as OwnedProduct[];
}

export async function getReading(): Promise<{
  inProgress: ReadingRow[];
  finished: ReadingRow[];
}> {
  if (isDemoMode()) {
    const stories = await getStories();
    return demoReading((slug) => {
      const s = stories.find((x) => x.slug === slug);
      return s
        ? { title: s.title, subtitle: s.subtitle, readingMinutes: s.readingMinutes }
        : null;
    });
  }
  const supabase = await createClient();

  const { data } = await supabase
    .from('reading_progress')
    .select('percent, last_read_at, completed_at, stories(slug, title, subtitle, reading_minutes)')
    .order('last_read_at', { ascending: false })
    .limit(50);

  const rows = (data ?? [])
    .map((r: Record<string, unknown>) => {
      const s = r.stories as Record<string, unknown> | null;
      if (!s) return null;
      return {
        slug: s.slug as string,
        title: s.title as string,
        subtitle: (s.subtitle as string) ?? null,
        percent: Number(r.percent ?? 0),
        readingMinutes: (s.reading_minutes as number) ?? null,
        lastReadAt: r.last_read_at as string,
        completedAt: (r.completed_at as string) ?? null,
      };
    })
    .filter(Boolean) as ReadingRow[];

  return {
    inProgress: rows.filter((r) => !r.completedAt),
    finished: rows.filter((r) => r.completedAt),
  };
}

export async function getSavedStories() {
  if (isDemoMode()) {
    const slugs = await demoSavedSlugs();
    const stories = await getStories();
    return slugs
      .map((slug) => stories.find((s) => s.slug === slug))
      .filter(Boolean)
      .map((s) => ({
        slug: s!.slug,
        title: s!.title,
        subtitle: s!.subtitle,
        readingMinutes: s!.readingMinutes,
      }));
  }
  const supabase = await createClient();

  const { data } = await supabase
    .from('saved_stories')
    .select('saved_at, stories(slug, title, subtitle, reading_minutes)')
    .order('saved_at', { ascending: false });

  return (data ?? [])
    .map((r: Record<string, unknown>) => {
      const s = r.stories as Record<string, unknown> | null;
      if (!s) return null;
      return {
        slug: s.slug as string,
        title: s.title as string,
        subtitle: (s.subtitle as string) ?? null,
        readingMinutes: (s.reading_minutes as number) ?? null,
      };
    })
    .filter(Boolean);
}

export { formatBytes } from './format';

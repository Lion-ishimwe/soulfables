import 'server-only';
import { createClient } from './supabase/server';
import { getViewer } from './auth';
import { isDemoMode } from './demo/mode';
import {
  demoOwnedProducts,
  demoReading,
  demoSavedSlugs,
  demoListeningPosition,
  demoBookmarks,
  demoPassages,
} from './demo/queries';
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
  /** Stories the purchase opens, when the book is a story rather than a file. */
  stories: { slug: string; title: string }[];
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
      'product_id, source, granted_at, products(slug, title, subtitle, cover_image, product_files(id, format, file_size_bytes, is_active), product_stories(stories(slug, title)))',
    )
    .is('revoked_at', null)
    // A lapsed grant is not owned; the download route would refuse it anyway.
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
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
        stories: (((p.product_stories as { stories?: { slug?: string; title?: string } | { slug?: string; title?: string }[] | null }[]) ?? [])
          .map((l) => (Array.isArray(l.stories) ? l.stories[0] : l.stories))
          .filter((st): st is { slug: string; title: string } => Boolean(st?.slug))
          .map((st) => ({ slug: st.slug, title: st.title ?? st.slug }))),
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

/** Where the reader left off in the narration, in seconds. */
export async function getListeningPosition(slug: string): Promise<number> {
  if (isDemoMode()) return demoListeningPosition(slug);

  /*
   * Nobody signed in has nowhere to have got to.
   *
   * RLS would return no rows anyway, so this changes no answer — it
   * saves the round trip to Frankfurt spent arriving at it. On a
   * narrated story that was half the time an anonymous reader waited for
   * the page.
   */
  const viewer = await getViewer();
  if (!viewer) return 0;

  const supabase = await createClient();
  const { data } = await supabase
    .from('reading_progress')
    .select('audio_position_seconds, stories!inner(slug)')
    .eq('stories.slug', slug)
    .maybeSingle();

  return Number(data?.audio_position_seconds ?? 0);
}

export type BookmarkRow = {
  id: string;
  storySlug: string;
  storyTitle: string | null;
  sectionTitle: string | null;
  note: string | null;
  createdAt: string;
};

export async function getBookmarks(): Promise<BookmarkRow[]> {
  if (isDemoMode()) {
    const stories = await getStories();
    const rows = await demoBookmarks();
    return rows.map((b) => ({
      id: b.id,
      storySlug: b.storySlug,
      storyTitle: stories.find((s) => s.slug === b.storySlug)?.title ?? null,
      sectionTitle: b.sectionTitle,
      note: b.note,
      createdAt: b.createdAt,
    }));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('bookmarks')
    .select('id, note, created_at, stories(slug, title), story_sections(title)')
    .order('created_at', { ascending: false });

  return (data ?? []).map((b: Record<string, unknown>) => {
    const story = b.stories as { slug?: string; title?: string } | null;
    const section = b.story_sections as { title?: string } | null;
    return {
      id: b.id as string,
      storySlug: story?.slug ?? '',
      storyTitle: story?.title ?? null,
      sectionTitle: section?.title ?? null,
      note: (b.note as string) ?? null,
      createdAt: b.created_at as string,
    };
  });
}

export type PassageRow = {
  id: string;
  storySlug: string;
  storyTitle: string | null;
  quote: string;
  createdAt: string;
};

export async function getPassages(): Promise<PassageRow[]> {
  if (isDemoMode()) {
    const stories = await getStories();
    const rows = await demoPassages();
    return rows.map((p) => ({
      id: p.id,
      storySlug: p.storySlug,
      storyTitle: stories.find((s) => s.slug === p.storySlug)?.title ?? null,
      quote: p.quote,
      createdAt: p.createdAt,
    }));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('saved_passages')
    .select('id, quote, created_at, stories(slug, title)')
    .order('created_at', { ascending: false });

  return (data ?? []).map((p: Record<string, unknown>) => {
    const story = p.stories as { slug?: string; title?: string } | null;
    return {
      id: p.id as string,
      storySlug: story?.slug ?? '',
      storyTitle: story?.title ?? null,
      quote: p.quote as string,
      createdAt: p.created_at as string,
    };
  });
}

import 'server-only';
import { createClient } from './supabase/server';

/**
 * Read helpers for the admin surface.
 *
 * These use the request-scoped client, not the service role — staff
 * access to content is already granted by RLS, so there is no reason to
 * reach for a key that bypasses it. The service role is reserved for the
 * four jobs listed in lib/supabase/admin.ts.
 */

export const isConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

export type AdminStoryRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  access: string;
  reading_minutes: number | null;
  published_at: string | null;
  updated_at: string;
  author: string | null;
};

export async function listStories(): Promise<AdminStoryRow[]> {
  if (!isConfigured()) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, title, slug, status, access, reading_minutes, published_at, updated_at, authors(name)',
    )
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[admin] listStories', error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    slug: r.slug as string,
    status: r.status as string,
    access: r.access as string,
    reading_minutes: (r.reading_minutes as number) ?? null,
    published_at: (r.published_at as string) ?? null,
    updated_at: r.updated_at as string,
    author: (r.authors as { name?: string } | null)?.name ?? null,
  }));
}

export async function getStory(id: string) {
  if (!isConfigured()) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from('stories')
    .select(
      'id, title, slug, subtitle, excerpt, body_mdx, author_id, access, status, seo_title, seo_description, story_shelves(shelf_id, is_primary)',
    )
    .eq('id', id)
    .single();

  if (!data) return null;

  const shelves = (data.story_shelves as { shelf_id: string; is_primary: boolean }[]) ?? [];
  const primary = shelves.find((s) => s.is_primary) ?? shelves[0];

  return {
    id: data.id as string,
    title: data.title as string,
    slug: data.slug as string,
    subtitle: data.subtitle as string | null,
    excerpt: data.excerpt as string | null,
    bodyMdx: data.body_mdx as string | null,
    authorId: data.author_id as string | null,
    shelfId: primary?.shelf_id ?? null,
    access: (data.access as 'free' | 'premium') ?? 'free',
    status: data.status as string,
    seoTitle: data.seo_title as string | null,
    seoDescription: data.seo_description as string | null,
  };
}

export async function listAuthorOptions() {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('authors')
    .select('id, name')
    .order('sort_order');
  return (data ?? []).map((a) => ({ value: a.id as string, label: a.name as string }));
}

export async function listShelfOptions() {
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('shelves')
    .select('id, label, title')
    .order('sort_order');
  return (data ?? []).map((s) => ({
    value: s.id as string,
    label: s.label as string,
  }));
}

export async function adminCounts() {
  if (!isConfigured()) {
    return { stories: 0, published: 0, drafts: 0, products: 0, orders: 0, readers: 0 };
  }
  const supabase = await createClient();

  const count = async (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    const { count: n } = await q;
    return n ?? 0;
  };

  const [stories, published, drafts, products, orders, readers] = await Promise.all([
    count('stories'),
    count('stories', ['status', 'published']),
    count('stories', ['status', 'draft']),
    count('products'),
    count('orders', ['status', 'paid']),
    count('profiles'),
  ]);

  return { stories, published, drafts, products, orders, readers };
}

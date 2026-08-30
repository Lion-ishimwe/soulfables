import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { getStories, getProducts, getShelves } from './content';
import { DEMO_BODIES } from './demo/stories';

/**
 * Read helpers for the admin surface.
 *
 * These use the request-scoped client, not the service role — staff
 * access to content is already granted by RLS, so there is no reason to
 * reach for a key that bypasses it. The service role is reserved for the
 * four jobs listed in lib/supabase/admin.ts.
 */

/**
 * Whether writes are possible.
 *
 * Demo mode renders the admin with real content so it can be walked
 * through, but nothing saves — the editor says so rather than silently
 * discarding an edit.
 */
export const isConfigured = () => !isDemoMode();

export const isReadOnly = () => isDemoMode();

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
  if (isDemoMode()) {
    const stories = await getStories();
    return stories.map((s, i) => ({
      id: s.id ?? `demo-${s.slug}`,
      title: s.title,
      slug: s.slug,
      status: 'published',
      access: s.access,
      reading_minutes: s.readingMinutes,
      // Staggered so the list looks like a real editorial history rather
      // than twelve stories published in the same second.
      published_at: new Date(Date.now() - (i + 1) * 5 * 86_400_000).toISOString(),
      updated_at: new Date(Date.now() - (i + 1) * 4 * 86_400_000).toISOString(),
      author: s.author,
    }));
  }
  if (!isConfigured()) return [];
  const supabase = await createClient();

  /*
   * The join is pinned to a named constraint on purpose.
   *
   * stories has two foreign keys to authors — author_id, whose name goes on
   * the story, and assigned_author_id, whoever is writing it right now.
   * PostgREST cannot choose between them and refuses the whole query with
   * "more than one relationship was found", so every one of these reads
   * returns nothing until it is told which. Demo mode never hit it: there
   * was no PostgREST to be ambiguous with.
   */
  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, title, slug, status, access, reading_minutes, published_at, updated_at, authors!stories_author_id_fkey(name)',
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
  if (isDemoMode()) {
    const slug = id.replace(/^demo-/, '');
    const stories = await getStories();
    const s = stories.find((x) => x.slug === slug);
    if (!s) return null;
    return {
      id,
      title: s.title,
      slug: s.slug,
      subtitle: s.subtitle,
      excerpt: null,
      bodyMdx: DEMO_BODIES[slug] ?? null,
      authorId: null,
      shelfId: null,
      access: s.access,
      status: 'published',
      seoTitle: null,
      seoDescription: null,
    };
  }
  if (!isConfigured()) return null;
  const supabase = await createClient();

  const { data } = await supabase
    .from('stories')
    .select(
      'id, title, slug, subtitle, excerpt, author_id, access, status, seo_title, seo_description, story_shelves(shelf_id, is_primary)',
    )
    .eq('id', id)
    .single();

  if (!data) return null;

  const { data: bodyMdx } = await supabase.rpc('story_body', {
    p_slug: data.slug as string,
  });

  const shelves = (data.story_shelves as { shelf_id: string; is_primary: boolean }[]) ?? [];
  const primary = shelves.find((s) => s.is_primary) ?? shelves[0];

  return {
    id: data.id as string,
    title: data.title as string,
    slug: data.slug as string,
    subtitle: data.subtitle as string | null,
    excerpt: data.excerpt as string | null,
    // Staff read the prose the same way readers do — through the
    // function. is_staff() inside it is what makes this return anything.
    bodyMdx: bodyMdx ?? null,
    authorId: data.author_id as string | null,
    shelfId: primary?.shelf_id ?? null,
    access: (data.access as 'free' | 'premium') ?? 'free',
    status: data.status as string,
    seoTitle: data.seo_title as string | null,
    seoDescription: data.seo_description as string | null,
  };
}

export async function listAuthorOptions() {
  if (isDemoMode()) {
    const stories = await getStories();
    return [...new Set(stories.map((s) => s.author))].map((name) => ({
      value: `demo-author-${name.toLowerCase().replace(/\W+/g, '-')}`,
      label: name,
    }));
  }
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('authors')
    .select('id, name')
    .order('sort_order');
  return (data ?? []).map((a) => ({ value: a.id as string, label: a.name as string }));
}

export async function listShelfOptions() {
  if (isDemoMode()) {
    const shelves = await getShelves();
    return shelves.map((s) => ({ value: `demo-shelf-${s.slug}`, label: s.label }));
  }
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
  if (isDemoMode()) {
    const [stories, products] = await Promise.all([getStories(), getProducts()]);
    return {
      stories: stories.length,
      published: stories.length,
      drafts: 0,
      products: products.length,
      orders: 3,
      readers: 1,
    };
  }
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

// ---------------------------------------------------------------------
// Shelves, authors and featured slots
// ---------------------------------------------------------------------

import type {
  EditorialShelf,
  EditorialAuthor,
  FeaturedSlot,
} from './demo/editorial';

export type AdminShelfRow = EditorialShelf & { storyCount: number };

export async function listAdminShelves(): Promise<AdminShelfRow[]> {
  const stories = await getStories();
  const count = (slug: string) =>
    stories.filter((st) => st.shelf === slug).length;

  if (isDemoMode()) {
    const { demoListShelves } = await import('./demo/editorial');
    return demoListShelves().map((sh) => ({ ...sh, storyCount: count(sh.slug) }));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('shelves')
    .select('slug, label, title, emoji, tagline, librarian_note, accent_color, sort_order, status, shelf_journeys(direction, shelves!shelf_journeys_related_shelf_id_fkey(slug))')
    .order('sort_order');

  return (data ?? []).map((r: Record<string, unknown>) => {
    const edges = (r.shelf_journeys as { direction: string; shelves: { slug: string } | null }[]) ?? [];
    return {
      slug: r.slug as string,
      label: r.label as string,
      title: r.title as string,
      emoji: (r.emoji as string) ?? '',
      tagline: (r.tagline as string) ?? '',
      librarianNote: (r.librarian_note as string) ?? null,
      entryStorySlug: null,
      accentColor: (r.accent_color as string) ?? null,
      sortOrder: (r.sort_order as number) ?? 0,
      status: (r.status as string) === 'published' ? 'published' : 'draft',
      arrivesFrom: edges.filter((e) => e.direction === 'arrives_from').map((e) => e.shelves?.slug ?? '').filter(Boolean),
      continuesTo: edges.filter((e) => e.direction === 'continues_to').map((e) => e.shelves?.slug ?? '').filter(Boolean),
      storyCount: count(r.slug as string),
    };
  });
}

export async function getAdminShelf(slug: string): Promise<AdminShelfRow | null> {
  const all = await listAdminShelves();
  return all.find((s) => s.slug === slug) ?? null;
}

export async function listAdminAuthors(): Promise<
  (EditorialAuthor & { storyCount: number })[]
> {
  const stories = await getStories();
  const count = (name: string) => stories.filter((st) => st.author === name).length;

  if (isDemoMode()) {
    const { demoListAuthors } = await import('./demo/editorial');
    return demoListAuthors().map((a) => ({ ...a, storyCount: count(a.name) }));
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('authors')
    .select('slug, name, bio, avatar_url, is_persona, sort_order')
    .order('sort_order');

  return (data ?? []).map((a: Record<string, unknown>) => ({
    slug: a.slug as string,
    name: a.name as string,
    bio: (a.bio as string) ?? null,
    avatarUrl: (a.avatar_url as string) ?? null,
    isPersona: Boolean(a.is_persona),
    sortOrder: (a.sort_order as number) ?? 0,
    storyCount: count(a.name as string),
  }));
}

export async function getAdminAuthor(slug: string) {
  const all = await listAdminAuthors();
  return all.find((a) => a.slug === slug) ?? null;
}

export async function listAdminFeatured(): Promise<FeaturedSlot[]> {
  if (isDemoMode()) {
    const { demoListFeatured } = await import('./demo/editorial');
    return demoListFeatured();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('featured_slots')
    .select('id, placement, entity_type, entity_id, headline, blurb, sort_order, ends_at')
    .order('placement')
    .order('sort_order');

  return (data ?? []).map((f: Record<string, unknown>) => ({
    id: f.id as string,
    placement: f.placement as FeaturedSlot['placement'],
    entityType: f.entity_type as FeaturedSlot['entityType'],
    // The slug is resolved for display by the page; the row stores an id.
    entitySlug: (f.entity_id as string) ?? '',
    headline: (f.headline as string) ?? null,
    blurb: (f.blurb as string) ?? null,
    sortOrder: (f.sort_order as number) ?? 0,
    active: !f.ends_at || new Date(f.ends_at as string) > new Date(),
  }));
}

// ---------------------------------------------------------------------
// Editorial workflow
// ---------------------------------------------------------------------

import type { EditorialStory, AuthorAccount, Notification } from './demo/editorial';

/** Ensures the demo story seed has run before anything reads it. */
async function ensureStories() {
  await getStories();
}

export type WorkStory = EditorialStory & {
  authorName: string | null;
  assignedName: string | null;
  shelfLabel: string | null;
};

async function decorate(rows: EditorialStory[]): Promise<WorkStory[]> {
  const { demoListAuthors, demoListShelves } = await import('./demo/editorial');
  const authors = demoListAuthors();
  const shelves = demoListShelves();

  const name = (slug: string | null) =>
    slug ? (authors.find((a) => a.slug === slug)?.name ?? null) : null;

  return rows.map((r) => ({
    ...r,
    authorName: name(r.authorSlug),
    assignedName: name(r.assignedAuthorSlug),
    shelfLabel: shelves.find((s) => s.slug === r.shelfSlug)?.label ?? null,
  }));
}

/** Every story, whatever its state — the admin list. */
export async function listWorkStories(): Promise<WorkStory[]> {
  await ensureStories();
  const { demoListStories } = await import('./demo/editorial');
  return decorate(demoListStories());
}

/** Waiting for the House to read them. */
export async function listSubmissions(): Promise<WorkStory[]> {
  return (await listWorkStories())
    .filter((s) => s.status === 'in_review')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export async function getWorkStory(slug: string): Promise<WorkStory | null> {
  return (await listWorkStories()).find((s) => s.slug === slug) ?? null;
}

/** What one author is carrying. */
export async function listStoriesForAuthor(
  authorSlug: string,
): Promise<WorkStory[]> {
  return (await listWorkStories()).filter(
    (s) => s.assignedAuthorSlug === authorSlug || s.authorSlug === authorSlug,
  );
}

export async function listAuthorAccounts(): Promise<AuthorAccount[]> {
  const { demoListAccounts } = await import('./demo/editorial');
  return demoListAccounts();
}

export async function accountForEmail(
  email: string | null,
): Promise<AuthorAccount | null> {
  if (!email) return null;
  const { demoAccountFor } = await import('./demo/editorial');
  return demoAccountFor(email);
}

export async function notificationsFor(
  authorSlug: string,
): Promise<Notification[]> {
  const { demoNotifications } = await import('./demo/editorial');
  return demoNotifications(authorSlug);
}

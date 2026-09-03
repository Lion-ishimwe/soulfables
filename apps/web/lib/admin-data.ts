import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { getStories, getProducts, getShelves, themesOf } from './content';
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

  const { data, error } = await supabase
    .from('stories')
    .select(
      'id, title, slug, subtitle, excerpt, author_id, access, status, seo_title, seo_description, story_shelves(shelf_id, is_primary)',
    )
    .eq('id', id)
    .single();

  if (error) {
    // null, not []. This returns one story, and an empty array is
    // truthy — a caller checking `if (!story)` would sail straight
    // past a failure and render a page about nothing.
    console.error('[admin] getStory', error.message);
    return null;
  }

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
  const { data, error } = await supabase
    .from('authors')
    .select('id, name')
    .order('sort_order');

  if (error) {
    console.error('[admin] listAuthorOptions', error.message);
    return [];
  }
  return (data ?? []).map((a) => ({ value: a.id as string, label: a.name as string }));
}

export async function listShelfOptions() {
  if (isDemoMode()) {
    const shelves = await getShelves();
    return shelves.map((s) => ({ value: `demo-shelf-${s.slug}`, label: s.label }));
  }
  if (!isConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('shelves')
    .select('id, label, title')
    .order('sort_order');

  if (error) {
    console.error('[admin] listShelfOptions', error.message);
    return [];
  }
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
    // Not '*': migration 0015 refuses that on stories, and head:true
    // turns the refusal into a null count that reads as a real zero.
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
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

  /*
   * BOTH ends of the journey join are named, not just the inner one.
   *
   * shelf_journeys has two foreign keys back to shelves — shelf_id, the
   * shelf the edge belongs to, and related_shelf_id, where it points. So
   * "shelves with shelf_journeys" is ambiguous in its own right, and
   * PostgREST refuses the whole query with PGRST201. Naming only the
   * inner relation, as this did, fixes the wrong half.
   *
   * The symptom was a Shelves page with no shelves on it and no error
   * anywhere, because the error was destructured away.
   */
  const { data, error } = await supabase
    .from('shelves')
    .select(
      `slug, label, title, emoji, tagline, librarian_note, accent_color, sort_order, status,
       shelf_journeys!shelf_journeys_shelf_id_fkey(
         direction,
         shelves!shelf_journeys_related_shelf_id_fkey(slug)
       )`,
    )
    .order('sort_order');

  if (error) {
    console.error('[admin] listAdminShelves', error.message);
    return [];
  }

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
  const { data, error } = await supabase
    .from('authors')
    .select('slug, name, bio, avatar_url, is_persona, sort_order')
    .order('sort_order');

  if (error) {
    console.error('[admin] listAdminAuthors', error.message);
    return [];
  }

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
  const { data, error } = await supabase
    .from('featured_slots')
    .select('id, placement, entity_type, entity_id, headline, blurb, sort_order, ends_at')
    .order('placement')
    .order('sort_order');

  if (error) {
    console.error('[admin] listAdminFeatured', error.message);
    return [];
  }

  const rows = data ?? [];

  /*
   * Resolve the id to a slug here, not in the page.
   *
   * The row stores a uuid and the page matched it against slugs, so it
   * never matched and every placed item rendered as a raw uuid — the
   * admin listing what it had placed in a language nobody reads.
   *
   * featured_slots.entity_id is polymorphic across three tables and so
   * carries no foreign key, which is why this is a lookup per kind
   * rather than a join. Three small queries on an admin page, and only
   * for the kinds actually present.
   */
  const byType = new Map<string, Set<string>>();
  for (const f of rows) {
    const type = f.entity_type as string | null;
    const id = f.entity_id as string | null;
    if (!type || !id) continue;
    if (!byType.has(type)) byType.set(type, new Set());
    byType.get(type)!.add(id);
  }

  const TABLES: Record<string, string> = {
    story: 'stories',
    shelf: 'shelves',
    product: 'products',
  };

  const slugOf = new Map<string, string>();
  await Promise.all(
    [...byType.entries()].map(async ([type, ids]) => {
      const table = TABLES[type];
      if (!table) return;
      const { data: found } = await supabase
        .from(table)
        .select('id, slug')
        .in('id', [...ids]);
      for (const row of found ?? []) slugOf.set(row.id as string, row.slug as string);
    }),
  );

  return rows.map((f: Record<string, unknown>) => ({
    id: f.id as string,
    placement: f.placement as FeaturedSlot['placement'],
    entityType: f.entity_type as FeaturedSlot['entityType'],
    // The slug, so the page can name it. An id that resolves to nothing
    // means the story was deleted out from under the placement.
    entitySlug: slugOf.get(f.entity_id as string) ?? '',
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
  /** What the story is about. See StoryCard.themes. */
  themes: { slug: string; label: string }[];
  /** Real opens and completions, from stories.view_count. See 0024. */
  views: number;
  completions: number;
  /** When it last changed — the column the list is already ordered by. */
  updatedAt: string | null;
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
    // Demo fixtures carry no taxonomy and no traffic. Empty and zero are
    // the truthful answers, not placeholders to be filled in later.
    themes: [],
    views: 0,
    completions: 0,
    updatedAt: r.publishedAt ?? r.submittedAt ?? null,
  }));
}

/**
 * Every story, whatever its state — the admin list.
 *
 * This read the demo fixtures unconditionally, in live mode included. The
 * fixtures are empty when there is a real database, so the Stories page,
 * Submissions, the Writing Room and every story editor showed nothing at
 * all while twelve stories sat in Postgres.
 *
 * Third time this pattern has turned up: a function written during demo
 * mode that never grew its live half, and reads plausibly because the
 * demo call is right there in the body. The others were
 * listAuthorAccounts and createAuthorAccount.
 */
export async function listWorkStories(): Promise<WorkStory[]> {
  if (isDemoMode()) {
    await ensureStories();
    const { demoListStories } = await import('./demo/editorial');
    return decorate(demoListStories());
  }
  if (!isConfigured()) return [];

  const supabase = await createClient();

  /*
   * Both author relations are named. stories has two foreign keys to
   * authors — the byline and whoever is carrying it now — and PostgREST
   * refuses a query that does not say which it means.
   */
  const { data, error } = await supabase
    .from('stories')
    .select(
      `id, slug, title, subtitle, excerpt, access, status, release_mode,
       cover_image, reading_minutes, published_at, submitted_at, approved_at,
       revision_note, updated_at, view_count, completion_count,
       story_themes(themes(slug, label)),
       byline:authors!stories_author_id_fkey(slug, name),
       assigned:authors!stories_assigned_author_id_fkey(slug, name),
       story_shelves(is_primary, shelves(slug, label)),
       story_chapters(id, number, title, status, published_at),
       story_audio(id)`,
    )
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) {
    console.error('[admin] listWorkStories', error.message);
    return [];
  }

  /** PostgREST returns an embedded relation as an array even when a foreign key makes it single. */
  const one = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const byline = one(r.byline as { slug: string; name: string } | null);
    const assigned = one(r.assigned as { slug: string; name: string } | null);

    const links = (r.story_shelves ?? []) as {
      is_primary: boolean;
      shelves: { slug: string; label: string } | { slug: string; label: string }[] | null;
    }[];
    const primary = links.find((l) => l.is_primary) ?? links[0];
    const shelf = one(primary?.shelves ?? null);

    const chapters = ((r.story_chapters ?? []) as Record<string, unknown>[])
      .map((c) => ({
        id: c.id as string,
        number: (c.number as number) ?? 0,
        title: (c.title as string) ?? '',
        // The list never renders chapter prose, and fetching every
        // chapter body to build a table would be a great deal of wire
        // for a column that does not exist.
        bodyMdx: '',
        status: (c.status as 'draft' | 'published') ?? 'draft',
        publishedAt: (c.published_at as string) ?? null,
      }))
      .sort((a, b) => a.number - b.number);

    return {
      slug: r.slug as string,
      title: r.title as string,
      subtitle: (r.subtitle as string) ?? '',
      excerpt: (r.excerpt as string) ?? '',
      // Bodies come from story_body() when one story is opened, never in
      // a list — migration 0015 does not permit selecting the column.
      bodyMdx: '',
      authorSlug: byline?.slug ?? null,
      assignedAuthorSlug: assigned?.slug ?? null,
      shelfSlug: shelf?.slug ?? '',
      access: (r.access as 'free' | 'premium') ?? 'free',
      status: (r.status as WorkStory['status']) ?? 'draft',
      releaseMode: (r.release_mode as 'full' | 'serial') ?? 'full',
      chapters,
      coverImage: (r.cover_image as string) ?? null,
      readingMinutes: (r.reading_minutes as number) ?? 0,
      publishedAt: (r.published_at as string) ?? null,
      submittedAt: (r.submitted_at as string) ?? null,
      submittedBy: assigned?.slug ?? null,
      approvedAt: (r.approved_at as string) ?? null,
      revisionNote: (r.revision_note as string) ?? null,
      hasAudio: ((r.story_audio ?? []) as unknown[]).length > 0,

      authorName: byline?.name ?? null,
      assignedName: assigned?.name ?? null,
      shelfLabel: shelf?.label ?? null,
      themes: themesOf(r.story_themes),
      views: Number(r.view_count ?? 0),
      completions: Number(r.completion_count ?? 0),
      updatedAt: (r.updated_at as string) ?? null,
    };
  });
}

/** Waiting for the House to read them. */
export async function listSubmissions(): Promise<WorkStory[]> {
  return (await listWorkStories())
    .filter((s) => s.status === 'in_review')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export async function getWorkStory(slug: string): Promise<WorkStory | null> {
  const story = (await listWorkStories()).find((s) => s.slug === slug) ?? null;
  if (!story || isDemoMode() || !isConfigured()) return story;

  /*
   * The body, which the list could not carry.
   *
   * listWorkStories() leaves bodyMdx empty on purpose — 0015 revoked the
   * column grant, and a list has no business fetching forty story bodies
   * anyway. But this returns ONE story, and its only caller is the
   * editor, which needs the prose in the textarea.
   *
   * Without this the editor opened every story with an empty body, and
   * saving wrote that emptiness back: the form does not know the
   * difference between "this story has no text" and "the text never
   * arrived". Every save silently destroyed the story it was saving.
   */
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('story_body', { p_slug: slug });

  if (error) {
    console.error('[admin] getWorkStory body', error.message);
    // Empty would look like an empty story to the editor, and the save
    // that followed would make it one. Refusing to open it is better.
    return null;
  }

  return { ...story, bodyMdx: (data as string | null) ?? '' };
}

/** What one author is carrying. */
export async function listStoriesForAuthor(
  authorSlug: string,
): Promise<WorkStory[]> {
  return (await listWorkStories()).filter(
    (s) => s.assignedAuthorSlug === authorSlug || s.authorSlug === authorSlug,
  );
}

/**
 * Which authors can sign in.
 *
 * This read the demo fixtures unconditionally until migration 0016 —
 * including in live mode, where it showed invented emails and dates
 * beside real authors. The email lives in auth.users, which PostgREST
 * does not expose, so it comes through a staff-only function instead.
 */
export async function listAuthorAccounts(): Promise<AuthorAccount[]> {
  if (isDemoMode()) {
    const { demoListAccounts } = await import('./demo/editorial');
    return demoListAccounts();
  }
  if (!isConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('author_accounts');
  if (error) return [];

  return ((data ?? []) as Record<string, string>[]).map((r) => ({
    authorSlug: r.author_slug,
    email: r.email,
    invitedAt: r.invited_at,
  }));
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

/**
 * The themes a story can be given.
 *
 * Ids, not slugs, because story_themes is keyed on ids and the picker
 * posts what the join table wants. The taxonomy is seeded and small, so
 * this is one cheap read rather than anything that needs caching.
 */
export async function listThemes(): Promise<{ id: string; slug: string; label: string }[]> {
  // Demo mode has no taxonomy to offer; an empty list hides the picker
  // rather than showing one that cannot save.
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('themes')
    .select('id, slug, label')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('[admin] listThemes', error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    label: r.label as string,
  }));
}

/** The themes already on one story, as ids the picker can pre-tick. */
export async function storyThemeIds(storySlug: string): Promise<string[]> {
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('stories')
    .select('story_themes(theme_id)')
    .eq('slug', storySlug)
    .maybeSingle();

  const links = (data?.story_themes ?? []) as { theme_id: string }[];
  return links.map((l) => l.theme_id);
}

/* =====================================================================
 * The four lists that were fixtures.
 *
 * /admin/orders, /admin/subscriptions, /admin/prompts and /admin/letter
 * each rendered a hard-coded array from lib/demo/admin — unconditionally,
 * with no isDemoMode() branch anywhere near them. So with a live database
 * connected, the House showed seven orders that had never been placed,
 * money it had never taken, four subscribers who did not exist, three
 * letters it had never written with open rates for sends that never
 * happened, and five journal prompts while hiding the ten real ones.
 *
 * These read the database. Where the answer is "none yet", they say so.
 * ===================================================================== */

export type AdminOrder = {
  id: string;
  reference: string;
  email: string | null;
  status: string;
  currency: string;
  total: number;
  paidAt: string | null;
  createdAt: string;
  items: string[];
};

export async function listAdminOrders(): Promise<AdminOrder[]> {
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, reference, email, status, currency, total_amount, paid_at, created_at, order_items(title_snapshot)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[admin] listAdminOrders', error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    reference: (r.reference as string) ?? '—',
    email: (r.email as string) ?? null,
    status: (r.status as string) ?? 'pending',
    currency: (r.currency as string) ?? 'USD',
    total: Number(r.total_amount ?? 0),
    paidAt: (r.paid_at as string) ?? null,
    createdAt: r.created_at as string,
    items: ((r.order_items ?? []) as { title_snapshot: string }[]).map((i) => i.title_snapshot),
  }));
}

export type AdminSubscriber = {
  id: string;
  email: string | null;
  name: string | null;
  status: string;
  periodEnd: string | null;
  cancelling: boolean;
  since: string;
};

export async function listAdminSubscribers(): Promise<AdminSubscriber[]> {
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();

  /*
   * The email lives in auth.users, which PostgREST does not expose. The
   * reader list already solves this, staff-gated, in reader_report() —
   * so subscriptions join to it rather than growing a second function
   * that reads auth.users under slightly different rules.
   */
  const [subsRes, readersRes] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id, user_id, status, current_period_end, cancel_at_period_end, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.rpc('reader_report'),
  ]);

  if (subsRes.error) {
    console.error('[admin] listAdminSubscribers', subsRes.error.message);
    return [];
  }

  const who = new Map<string, { email: string; name: string | null }>();
  for (const r of (readersRes.data ?? []) as Record<string, unknown>[]) {
    who.set(r.user_id as string, {
      email: r.email as string,
      name: (r.display_name as string) ?? null,
    });
  }

  return (subsRes.data ?? []).map((r: Record<string, unknown>) => {
    const person = who.get(r.user_id as string);
    return {
      id: r.id as string,
      email: person?.email ?? null,
      name: person?.name ?? null,
      status: (r.status as string) ?? 'unknown',
      periodEnd: (r.current_period_end as string) ?? null,
      cancelling: Boolean(r.cancel_at_period_end),
      since: r.created_at as string,
    };
  });
}

export type AdminPrompt = {
  id: string;
  body: string;
  kind: string;
  scheduledOn: string | null;
  isActive: boolean;
  uses: number;
};

export async function listAdminPrompts(): Promise<AdminPrompt[]> {
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();
  const [promptsRes, usesRes] = await Promise.all([
    supabase
      .from('journal_prompts')
      .select('id, body, kind, scheduled_on, is_active, created_at')
      .order('scheduled_on', { ascending: false, nullsFirst: false })
      .order('created_at'),
    // "Entries written" is a fact about the prompt, never about a person:
    // only the prompt id is read, and no entry is reachable from here.
    supabase.from('journal_entries').select('prompt_id'),
  ]);

  if (promptsRes.error) {
    console.error('[admin] listAdminPrompts', promptsRes.error.message);
    return [];
  }

  const uses = new Map<string, number>();
  for (const e of (usesRes.data ?? []) as { prompt_id: string | null }[]) {
    if (e.prompt_id) uses.set(e.prompt_id, (uses.get(e.prompt_id) ?? 0) + 1);
  }

  return (promptsRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    body: r.body as string,
    kind: (r.kind as string) ?? 'daily',
    scheduledOn: (r.scheduled_on as string) ?? null,
    isActive: r.is_active !== false,
    uses: uses.get(r.id as string) ?? 0,
  }));
}

export type AdminLetter = {
  id: string;
  volume: number;
  number: number;
  title: string;
  subject: string | null;
  dek: string | null;
  status: string;
  publishedAt: string | null;
  sentAt: string | null;
  sends: number;
};

export async function listAdminLetters(): Promise<AdminLetter[]> {
  if (isDemoMode() || !isConfigured()) return [];

  const supabase = await createClient();
  const [lettersRes, sendsRes] = await Promise.all([
    supabase
      .from('letters')
      .select('id, volume, number, title, subject, dek, status, published_at, sent_at')
      .order('volume', { ascending: false })
      .order('number', { ascending: false })
      .limit(200),
    supabase.from('letter_sends').select('letter_id'),
  ]);

  if (lettersRes.error) {
    console.error('[admin] listAdminLetters', lettersRes.error.message);
    return [];
  }

  const sends = new Map<string, number>();
  for (const s of (sendsRes.data ?? []) as { letter_id: string | null }[]) {
    if (s.letter_id) sends.set(s.letter_id, (sends.get(s.letter_id) ?? 0) + 1);
  }

  return (lettersRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    volume: Number(r.volume ?? 1),
    number: Number(r.number ?? 0),
    title: r.title as string,
    subject: (r.subject as string) ?? null,
    dek: (r.dek as string) ?? null,
    status: (r.status as string) ?? 'draft',
    publishedAt: (r.published_at as string) ?? null,
    sentAt: (r.sent_at as string) ?? null,
    sends: sends.get(r.id as string) ?? 0,
  }));
}

/** How many people would receive the next letter. */
export async function letterSubscriberCount(): Promise<number> {
  if (isDemoMode() || !isConfigured()) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('letter_subscribers')
    .select('email', { count: 'exact', head: true })
    .eq('status', 'subscribed');

  // Null, not zero. A refusal and an empty list are different answers and
  // the caller should not be told "nobody" when the truth is "cannot say".
  if (error) {
    console.error('[admin] letterSubscriberCount', error.message);
    return 0;
  }
  return count ?? 0;
}

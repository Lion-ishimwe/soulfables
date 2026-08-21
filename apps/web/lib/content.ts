import 'server-only';
import { formatMoney } from './format';
import { isDemoMode } from './demo/mode';
import { DEMO_BODIES } from './demo/stories';

/**
 * Content access layer.
 *
 * Every page reads through these functions, never through a Supabase
 * client directly. Two reasons: the paywall rule for premium bodies lives
 * in exactly one place, and the app stays reviewable before the database
 * exists — when Supabase is not configured, these fall back to the same
 * data the seed file inserts, so the design can be worked on offline.
 *
 * Remove the fallback once the database is live; the signature does not
 * change, so no page needs editing.
 */

export type Shelf = {
  slug: string;
  label: string;
  title: string;
  emoji: string;
  tagline: string;
  librarianNote?: string;
};

export type StoryCard = {
  /**
   * Present only when a database is behind this. The offline fallback has
   * no ids, and the reader's save/progress controls are hidden without
   * one — there is nothing real to write against.
   */
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  readingMinutes: number;
  shelf: string;
  access: 'free' | 'premium';
};

export type Product = {
  /** Present only with a database behind it; see StoryCard.id. */
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  kind: string;
  eyebrow: string;
  pullQuote: string;
  ctaLabel: string;
  priceLabel: string;
  formats: string[];
  featured: boolean;
};

/** Demo mode swaps the whole data source; see lib/demo/mode.ts. */
const isConfigured = !isDemoMode();

// ---------------------------------------------------------------------
// Fallback content — mirrors database/seed/0001_house.sql exactly.
// ---------------------------------------------------------------------

const SHELVES: Shelf[] = [
  { slug: 'heartbreak', label: 'Heartbreak', title: 'Stories About Heartbreak', emoji: '❤️', tagline: 'Love, loss, and the slow art of letting go.', librarianNote: 'Stay as long as you need. But don’t forget the Healing shelf exists — readers rarely stay here forever. They usually leave carrying Hope.' },
  { slug: 'healing', label: 'Healing', title: 'Stories About Healing', emoji: '🌿', tagline: 'The quiet work that happens after the worst of it.' },
  { slug: 'anxiety', label: 'Sleepless', title: 'Stories for the Sleepless', emoji: '🌙', tagline: 'For the nights the mind will not put itself down.' },
  { slug: 'change', label: 'New Beginnings', title: 'Stories About Beginning Again', emoji: '🌊', tagline: 'What it costs to start, and what it gives back.' },
  { slug: 'love', label: 'Love', title: 'Stories About Love', emoji: '💛', tagline: 'In all the shapes it arrives in.' },
  { slug: 'loneliness', label: 'Loneliness', title: 'Stories About Loneliness', emoji: '🕯️', tagline: 'Company for the hours that have none.' },
  { slug: 'grief', label: 'Grief', title: 'Stories About Grief', emoji: '🕊️', tagline: 'For what stays after someone goes.' },
  { slug: 'hope', label: 'Hope', title: 'Stories About Hope', emoji: '✨', tagline: 'Quiet, stubborn, and usually early.' },
  { slug: 'forgiveness', label: 'Forgiveness', title: 'Stories About Forgiveness', emoji: '🤍', tagline: 'Including the hardest one, which is yourself.' },
];

const STORIES: StoryCard[] = [
  { id: 'demo-the-house-after-you-left', slug: 'the-house-after-you-left', title: 'The House After You Left', subtitle: 'A modern folktale about the rooms grief keeps lit', author: 'The Librarian', readingMinutes: 11, shelf: 'heartbreak', access: 'free' },
  { id: 'demo-the-map-without-my-home', slug: 'the-map-without-my-home', title: 'The Map Without My Home', subtitle: 'A map that still points to the place you left', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'change', access: 'free' },
  { id: 'demo-the-name-i-left-behind', slug: 'the-name-i-left-behind', title: 'The Name I Left Behind', subtitle: 'Leaving a name behind to find who you are', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'change', access: 'free' },
  { id: 'demo-the-voice-in-the-river', slug: 'the-voice-in-the-river', title: 'The Voice in the River', subtitle: 'Finding a new language for life by sitting still long enough to hear what was already there.', author: 'Apophia Kamwine', readingMinutes: 8, shelf: 'healing', access: 'free' },
  { id: 'demo-the-seed-i-was-afraid-to-plant', slug: 'the-seed-i-was-afraid-to-plant', title: 'The Seed I Was Afraid to Plant', subtitle: 'Growing glass fruit because you were afraid of bruising.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { id: 'demo-the-light-that-outlasted', slug: 'the-light-that-outlasted', title: 'The Light That Outlasted', subtitle: 'Love that outlasts loss — the kind that stays after the one who carried it is gone.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'grief', access: 'free' },
  { id: 'demo-the-house-that-burned-without-fire', slug: 'the-house-that-burned-without-fire', title: 'The House That Burned Without Fire', subtitle: 'Grief is not the fire — it is the smoke that lingers after.', author: 'Seren Adair', readingMinutes: 10, shelf: 'grief', access: 'free' },
  { id: 'demo-the-garden-remembered-me', slug: 'the-garden-remembered-me', title: 'The Garden Remembered Me', subtitle: 'The garden held what was planted long after the gardener had gone', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { id: 'demo-the-last-voice-note', slug: 'the-last-voice-note', title: 'The Last Voice Note', subtitle: 'Some people leave. Their voices don’t.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'grief', access: 'free' },
  { id: 'demo-the-stranger-in-my-mirror', slug: 'the-stranger-in-my-mirror', title: 'The Stranger in My Mirror', subtitle: 'You wake up and realise you have spent years becoming someone everyone else recognises.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'change', access: 'free' },
  { id: 'demo-letters-to-the-tide', slug: 'letters-to-the-tide', title: 'Letters to the Tide', subtitle: 'Words cast to the waves, waiting for a tide that understands.', author: 'Caelum Orr', readingMinutes: 12, shelf: 'heartbreak', access: 'premium' },
  { id: 'demo-the-sister-who-left-and-returned', slug: 'the-sister-who-left-and-returned', title: 'The Sister Who Left and Returned', subtitle: 'Family is not the tie that binds — it is the river that keeps flowing.', author: 'Caelum Orr', readingMinutes: 11, shelf: 'healing', access: 'free' },
];

const PRODUCTS: Product[] = [
  { id: 'demo-the-version-of-me-you-broke', slug: 'the-version-of-me-you-broke', title: 'The Version Of Me You Broke', subtitle: 'A Soulfables Original by Apophia Kamwine', kind: 'ebook', eyebrow: 'Soulfables Original · New Release', pullQuote: 'You didn’t lose yourself forever. You were waiting to come home.', ctaLabel: 'Come home to yourself', priceLabel: '$7.99', formats: ['EPUB', 'PDF'], featured: true },
  { id: 'demo-the-soulfables-library', slug: 'the-soulfables-library', title: 'The Soulfables Library', subtitle: 'Your Complete Sanctuary', kind: 'bundle', eyebrow: 'The Librarian’s Collection', pullQuote: 'Every story, every journal, every reflection — kept together in one library.', ctaLabel: 'Explore the complete library', priceLabel: '$45', formats: ['EPUB', 'PDF'], featured: false },
  { id: 'demo-heartbreak-anthology', slug: 'heartbreak-anthology', title: 'Heartbreak Anthology', subtitle: 'Stories for the Aftermath', kind: 'anthology', eyebrow: 'Your Signature Collection', pullQuote: 'The collection that introduced thousands of readers to Soulfables.', ctaLabel: 'Begin with heartbreak', priceLabel: '$16', formats: ['EPUB', 'PDF'], featured: false },
  { id: 'demo-the-soul-journal', slug: 'the-soul-journal', title: 'The Soul Journal', subtitle: 'A Companion for Quiet Reflection', kind: 'journal', eyebrow: 'The Everyday Companion', pullQuote: 'A quiet place to write after every story.', ctaLabel: 'Start writing', priceLabel: '$18', formats: ['PDF'], featured: false },
  { id: 'demo-the-reflection-deck', slug: 'the-reflection-deck', title: 'The Reflection Deck', subtitle: 'Questions for the Quiet Moments', kind: 'deck', eyebrow: 'The Giftable Experience', pullQuote: '52 questions for the moments that ask something of you.', ctaLabel: 'Draw your first card', priceLabel: '$15', formats: ['PDF'], featured: false },
];

/** The journey graph, as seeded. Direction is from the shelf's point of view. */
const JOURNEYS: Record<string, { from: string[]; to: string[] }> = {
  heartbreak: { from: ['grief', 'love', 'loneliness'], to: ['healing', 'hope', 'forgiveness'] },
  healing: { from: ['heartbreak', 'grief'], to: ['hope', 'change'] },
  grief: { from: [], to: ['heartbreak', 'healing'] },
  loneliness: { from: [], to: ['heartbreak', 'hope'] },
  anxiety: { from: [], to: ['healing'] },
  change: { from: [], to: ['hope'] },
};

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

export async function getShelves(): Promise<Shelf[]> {
  if (!isConfigured) return SHELVES;
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase
    .from('shelves')
    .select('slug, label, title, emoji, tagline, librarian_note')
    .eq('status', 'published')
    .order('sort_order');
  return (data ?? []).map((r) => ({
    slug: r.slug, label: r.label, title: r.title,
    emoji: r.emoji ?? '', tagline: r.tagline ?? '',
    librarianNote: r.librarian_note ?? undefined,
  }));
}

export async function getShelf(slug: string): Promise<Shelf | null> {
  const all = await getShelves();
  return all.find((s) => s.slug === slug) ?? null;
}

export async function getStories(shelfSlug?: string): Promise<StoryCard[]> {
  if (!isConfigured) {
    return shelfSlug ? STORIES.filter((s) => s.shelf === shelfSlug) : STORIES;
  }
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  let query = supabase
    .from('stories')
    // Note: body_mdx is NOT selected here. Listings never carry story
    // bodies, so a premium body cannot leak through a card.
    .select('id, slug, title, subtitle, reading_minutes, access, authors(name), story_shelves!inner(shelves!inner(slug))')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (shelfSlug) query = query.eq('story_shelves.shelves.slug', shelfSlug);

  const { data } = await query;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? '',
    author: ((r.authors as { name?: string } | null)?.name) ?? 'Soulfables',
    readingMinutes: (r.reading_minutes as number) ?? 0,
    shelf: shelfSlug ?? '',
    access: (r.access as 'free' | 'premium') ?? 'free',
  }));
}

export async function getProducts(): Promise<Product[]> {
  if (!isConfigured) return PRODUCTS;
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('slug, title, subtitle, kind, eyebrow, pull_quote, cta_label, is_featured, product_prices(currency, unit_amount, is_default), product_files(format)')
    .eq('status', 'published')
    .order('sort_order');

  return (data ?? []).map((r: Record<string, unknown>) => {
    const prices = (r.product_prices as { currency: string; unit_amount: number; is_default: boolean }[]) ?? [];
    const price = prices.find((p) => p.is_default) ?? prices[0];
    return {
      slug: r.slug as string,
      title: r.title as string,
      subtitle: (r.subtitle as string) ?? '',
      kind: r.kind as string,
      eyebrow: (r.eyebrow as string) ?? '',
      pullQuote: (r.pull_quote as string) ?? '',
      ctaLabel: (r.cta_label as string) ?? 'View',
      priceLabel: price ? formatMoney(price.unit_amount, price.currency) : '',
      formats: ((r.product_files as { format: string }[]) ?? []).map((f) => f.format.toUpperCase()),
      featured: Boolean(r.is_featured),
    };
  });
}

export async function getJourney(shelfSlug: string) {
  const j = JOURNEYS[shelfSlug] ?? { from: [], to: [] };
  const shelves = await getShelves();
  const lookup = (slug: string) => shelves.find((s) => s.slug === slug);
  return {
    arrivesFrom: j.from.map(lookup).filter(Boolean) as Shelf[],
    continuesTo: j.to.map(lookup).filter(Boolean) as Shelf[],
  };
}

export { formatMoney } from './format';

/**
 * Search the library.
 *
 * Uses the generated tsvector on stories when a database is present, and
 * falls back to a plain substring match otherwise so the search page is
 * reviewable offline. `websearch` parsing means a reader can type
 * "grief -house" or a quoted phrase and have it mean what they expect.
 */
export async function searchStories(query: string): Promise<StoryCard[]> {
  const q = query.trim();
  if (!q) return [];

  if (!isConfigured) {
    const needle = q.toLowerCase();
    return STORIES.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.subtitle.toLowerCase().includes(needle) ||
        s.author.toLowerCase().includes(needle),
    );
  }

  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stories')
    // body_mdx is searched by the index but never selected — a premium
    // body must not leak through a search result.
    .select('id, slug, title, subtitle, reading_minutes, access, authors(name)')
    .eq('status', 'published')
    .textSearch('search_vector', q, { type: 'websearch', config: 'english' })
    .limit(50);

  if (error) {
    console.error('[search]', error.message);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? '',
    author: ((r.authors as { name?: string } | null)?.name) ?? 'Soulfables',
    readingMinutes: (r.reading_minutes as number) ?? 0,
    shelf: '',
    access: (r.access as 'free' | 'premium') ?? 'free',
  }));
}

/**
 * Wander — the Librarian chooses.
 *
 * Deterministic per hour rather than random per request: a story picked
 * fresh on every page load is a slot machine, and this is meant to feel
 * like being handed something. It changes on the hour, so coming back
 * later gives you a different one.
 */
export async function getWanderStory(): Promise<StoryCard | null> {
  const stories = (await getStories()).filter((s) => s.access === 'free');
  if (stories.length === 0) return null;

  const hourIndex = Math.floor(Date.now() / 3_600_000);
  return stories[hourIndex % stories.length];
}

export type FullStory = StoryCard & {
  /**
   * Null for a premium story the reader has no access to. The body is
   * withheld HERE, on the server, so it never reaches the browser at all —
   * there is no hidden text for a devtools inspector to reveal.
   */
  body: string | null;
  locked: boolean;
};

/**
 * One story, with its body — subject to the paywall.
 *
 * This is the single place the premium rule is applied. Every other read
 * path (listings, search, shelves) omits body_mdx from its select, so a
 * story body can only ever arrive through this function.
 */
export async function getStory(slug: string): Promise<FullStory | null> {
  if (!isConfigured) {
    const card = STORIES.find((s) => s.slug === slug);
    if (!card) return null;

    // The premium rule applies in demo mode too, so the paywall can be
    // demonstrated rather than described.
    const locked = card.access === 'premium';

    return {
      ...card,
      locked,
      body: locked ? null : (DEMO_BODIES[slug] ?? null),
    };
  }

  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();

  const { data } = await supabase
    .from('stories')
    .select('id, slug, title, subtitle, reading_minutes, access, body_mdx, authors(name), story_shelves(is_primary, shelves(slug))')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!data) return null;

  // PostgREST types an embedded relation as an array even where the FK
  // makes it single-valued, so normalise rather than fight the type.
  const shelves = (data.story_shelves ?? []) as unknown as {
    is_primary: boolean;
    shelves: { slug: string } | { slug: string }[] | null;
  }[];
  const primaryRow = shelves.find((s) => s.is_primary) ?? shelves[0];
  const primaryShelf = Array.isArray(primaryRow?.shelves)
    ? primaryRow.shelves[0]
    : primaryRow?.shelves;

  let locked = false;
  if (data.access === 'premium') {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      locked = true;
    } else {
      const { data: hasAccess } = await supabase.rpc('has_premium_access', {
        p_user: user.id,
      });
      locked = !hasAccess;
    }
  }

  return {
    id: data.id as string,
    slug: data.slug as string,
    title: data.title as string,
    subtitle: (data.subtitle as string) ?? '',
    author: ((data.authors as { name?: string } | null)?.name) ?? 'Soulfables',
    readingMinutes: (data.reading_minutes as number) ?? 0,
    shelf: primaryShelf?.slug ?? '',
    access: (data.access as 'free' | 'premium') ?? 'free',
    locked,
    // The line that matters: withheld server-side, not hidden with CSS.
    body: locked ? null : ((data.body_mdx as string) ?? null),
  };
}

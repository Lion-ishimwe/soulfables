import 'server-only';
import { unstable_cache } from 'next/cache';
import { formatMoney } from './format';
import { isDemoMode } from './demo/mode';
import { DEMO_BODIES, DEMO_NARRATED } from './demo/stories';

/** Section markers, shared by the reader, bookmarks and audio cues. */
function sectionsFrom(body: string) {
  return [...body.matchAll(/^::\s*(.+)$/gm)].map((m) => {
    const title = m[1].trim();
    return {
      title,
      slug:
        title
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'section',
    };
  });
}

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
  /** Present only with a database behind it; see StoryCard.id. */
  id?: string;
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
  /** Whether a narrated edition exists. */
  hasAudio?: boolean;
  /** Length of the narration, in minutes, when there is one and it is known. */
  audioMinutes?: number | null;
  /** A scheduled story, open early to Premium. */
  earlyAccess?: boolean;
  scheduledFor?: string | null;
  /** Uploaded artwork. Null means the drawn cover is used instead. */
  coverImage?: string | null;
  /**
   * What the story is about, as opposed to where it lives.
   *
   * A shelf is a place and a story sits on one; a theme is a subject and
   * a story usually carries two. The card shows them because "Grief,
   * Nostalgia" tells a reader what they are walking into in a way that
   * a subtitle written to be beautiful does not.
   */
  themes?: { slug: string; label: string }[];
  /** Real opens. Absent offline, and zero until somebody reads it. */
  views?: number;
  /** For sorting the Library by when things arrived. */
  publishedAt?: string | null;
};

export type Product = {
  /** Present only with a database behind it; see StoryCard.id. */
  id?: string;
  slug: string;
  /** Uploaded artwork. Null means the drawn cover is used instead. */
  coverImage?: string | null;
  title: string;
  subtitle: string;
  kind: string;
  eyebrow: string;
  pullQuote: string;
  ctaLabel: string;
  priceLabel: string;
  /** The default price in minor units, for structured data and checkout copy. */
  price: { unitAmount: number; currency: string } | null;
  /** The long copy, paragraphs separated by blank lines. */
  description: string | null;
  formats: string[];
  /** The active files, one per format, with sizes where known. */
  files: { format: string; sizeBytes: number | null }[];
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
  { id: 'demo-the-name-i-left-behind', slug: 'the-name-i-left-behind', title: 'The Name I Left Behind', subtitle: 'Leaving a name behind to find who you are', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'forgiveness', access: 'free' },
  { id: 'demo-the-voice-in-the-river', slug: 'the-voice-in-the-river', title: 'The Voice in the River', subtitle: 'Finding a new language for life by sitting still long enough to hear what was already there.', author: 'Apophia Kamwine', readingMinutes: 8, shelf: 'anxiety', access: 'free' },
  { id: 'demo-the-seed-i-was-afraid-to-plant', slug: 'the-seed-i-was-afraid-to-plant', title: 'The Seed I Was Afraid to Plant', subtitle: 'Growing glass fruit because you were afraid of bruising.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { id: 'demo-the-light-that-outlasted', slug: 'the-light-that-outlasted', title: 'The Light That Outlasted', subtitle: 'Love that outlasts loss — the kind that stays after the one who carried it is gone.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'love', access: 'free' },
  { id: 'demo-the-house-that-burned-without-fire', slug: 'the-house-that-burned-without-fire', title: 'The House That Burned Without Fire', subtitle: 'Grief is not the fire — it is the smoke that lingers after.', author: 'Seren Adair', readingMinutes: 10, shelf: 'grief', access: 'free' },
  { id: 'demo-the-garden-remembered-me', slug: 'the-garden-remembered-me', title: 'The Garden Remembered Me', subtitle: 'The garden held what was planted long after the gardener had gone', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { id: 'demo-the-last-voice-note', slug: 'the-last-voice-note', title: 'The Last Voice Note', subtitle: 'Some people leave. Their voices don’t.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'grief', access: 'free' },
  { id: 'demo-the-stranger-in-my-mirror', slug: 'the-stranger-in-my-mirror', title: 'The Stranger in My Mirror', subtitle: 'You wake up and realise you have spent years becoming someone everyone else recognises.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'loneliness', access: 'free' },
  { id: 'demo-letters-to-the-tide', slug: 'letters-to-the-tide', title: 'Letters to the Tide', subtitle: 'Words cast to the waves, waiting for a tide that understands.', author: 'Caelum Orr', readingMinutes: 12, shelf: 'heartbreak', access: 'premium' },
  { id: 'demo-the-sister-who-left-and-returned', slug: 'the-sister-who-left-and-returned', title: 'The Sister Who Left and Returned', subtitle: 'Family is not the tie that binds — it is the river that keeps flowing.', author: 'Caelum Orr', readingMinutes: 11, shelf: 'hope', access: 'free' },
];

const PRODUCTS: Product[] = [
  { id: 'demo-the-version-of-me-you-broke', slug: 'the-version-of-me-you-broke', title: 'The Version Of Me You Broke', subtitle: 'A Soulfables Original by Apophia Kamwine', kind: 'ebook', eyebrow: 'Soulfables Original · New Release', pullQuote: 'You didn’t lose yourself forever. You were waiting to come home.', ctaLabel: 'Come home to yourself', priceLabel: '$7.99', formats: ['EPUB', 'PDF'], price: { unitAmount: 799, currency: 'USD' }, description: null, files: [{ format: 'EPUB', sizeBytes: null }, { format: 'PDF', sizeBytes: null }], featured: true },
  { id: 'demo-the-soulfables-library', slug: 'the-soulfables-library', title: 'The Soulfables Library', subtitle: 'Your Complete Sanctuary', kind: 'bundle', eyebrow: 'The Librarian’s Collection', pullQuote: 'Every story, every journal, every reflection — kept together in one library.', ctaLabel: 'Explore the complete library', priceLabel: '$45', formats: ['EPUB', 'PDF'], price: { unitAmount: 4500, currency: 'USD' }, description: null, files: [{ format: 'EPUB', sizeBytes: null }, { format: 'PDF', sizeBytes: null }], featured: false },
  { id: 'demo-heartbreak-anthology', slug: 'heartbreak-anthology', title: 'Heartbreak Anthology', subtitle: 'Stories for the Aftermath', kind: 'anthology', eyebrow: 'Your Signature Collection', pullQuote: 'The collection that introduced thousands of readers to Soulfables.', ctaLabel: 'Begin with heartbreak', priceLabel: '$16', formats: ['EPUB', 'PDF'], price: { unitAmount: 1600, currency: 'USD' }, description: null, files: [{ format: 'EPUB', sizeBytes: null }, { format: 'PDF', sizeBytes: null }], featured: false },
  { id: 'demo-the-soul-journal', slug: 'the-soul-journal', title: 'The Soul Journal', subtitle: 'A Companion for Quiet Reflection', kind: 'journal', eyebrow: 'The Everyday Companion', pullQuote: 'A quiet place to write after every story.', ctaLabel: 'Start writing', priceLabel: '$18', formats: ['PDF'], price: { unitAmount: 1800, currency: 'USD' }, description: null, files: [{ format: 'PDF', sizeBytes: null }], featured: false },
  { id: 'demo-the-reflection-deck', slug: 'the-reflection-deck', title: 'The Reflection Deck', subtitle: 'Questions for the Quiet Moments', kind: 'deck', eyebrow: 'The Giftable Experience', pullQuote: '52 questions for the moments that ask something of you.', ctaLabel: 'Draw your first card', priceLabel: '$15', formats: ['PDF'], price: { unitAmount: 1500, currency: 'USD' }, description: null, files: [{ format: 'PDF', sizeBytes: null }], featured: false },
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


/**
 * Stories in demo mode live in the editorial store, not in the constant
 * below — otherwise nothing written or approved in the admin would ever
 * appear, and the whole submission workflow would be theatre. The
 * constant is the seed; the store is the truth.
 */
async function demoStories() {
  const ed = await import('./demo/editorial');

  ed.demoSeedStories(() =>
    STORIES.map((st) => ({
      slug: st.slug,
      title: st.title,
      subtitle: st.subtitle,
      excerpt: '',
      bodyMdx: DEMO_BODIES[st.slug] ?? '',
      authorSlug:
        st.author
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || null,
      // Assigned to whoever wrote it, so an author signing in finds
      // their own published work rather than an empty desk.
      assignedAuthorSlug:
        st.author
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || null,
      shelfSlug: st.shelf,
      access: st.access,
      status: 'published' as const,
      releaseMode: 'full' as const,
      coverImage: null,
      readingMinutes: st.readingMinutes,
      publishedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      submittedAt: null,
      submittedBy: null,
      approvedAt: null,
      revisionNote: null,
      hasAudio: DEMO_NARRATED.has(st.slug),
    })),
  );

  return ed.demoListStories();
}

/** Author name for a slug, so cards keep their byline. */
async function demoAuthorName(slug: string | null): Promise<string> {
  if (!slug) return 'Soulfables';
  const { demoListAuthors } = await import('./demo/editorial');
  return demoListAuthors().find((a) => a.slug === slug)?.name ?? 'Soulfables';
}

async function fetchGetShelves(): Promise<Shelf[]> {
  if (!isConfigured) {
    // Read the editorial store, not the constant — otherwise renaming a
    // shelf in the admin would change nothing a reader can see, which
    // would make the admin a decoration.
    const { demoListShelves } = await import('./demo/editorial');
    return demoListShelves()
      .filter((s) => s.status === 'published')
      .map((s) => ({
        slug: s.slug,
        label: s.label,
        title: s.title,
        emoji: s.emoji,
        tagline: s.tagline,
        librarianNote: s.librarianNote ?? undefined,
      }));
  }
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('shelves')
    .select('id, slug, label, title, emoji, tagline, librarian_note')
    .eq('status', 'published')
    .order('sort_order');
  return (data ?? []).map((r) => ({
    id: r.id, slug: r.slug, label: r.label, title: r.title,
    emoji: r.emoji ?? '', tagline: r.tagline ?? '',
    librarianNote: r.librarian_note ?? undefined,
  }));
}

export async function getShelf(slug: string): Promise<Shelf | null> {
  const all = await getShelves();
  return all.find((s) => s.slug === slug) ?? null;
}

/**
 * Flatten PostgREST's story_themes(themes(...)) into a plain list.
 *
 * Kept in one place because three callers need it and each would
 * otherwise re-derive the same two levels of nesting slightly
 * differently.
 */
export function themesOf(raw: unknown): { slug: string; label: string }[] {
  const links = (raw ?? []) as {
    themes: { slug: string; label: string } | { slug: string; label: string }[] | null;
  }[];

  return links
    .map((l) => (Array.isArray(l.themes) ? l.themes[0] : l.themes))
    .filter((t): t is { slug: string; label: string } => Boolean(t?.slug));
}

async function fetchGetStories(shelfSlug?: string): Promise<StoryCard[]> {
  if (!isConfigured) {
    const rows = (await demoStories()).filter((s) => s.status === 'published');

    const all: StoryCard[] = await Promise.all(
      rows.map(async (s) => ({
        id: `demo-${s.slug}`,
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        author: await demoAuthorName(s.authorSlug),
        readingMinutes: s.readingMinutes,
        shelf: s.shelfSlug,
        access: s.access,
        hasAudio: s.hasAudio,
        coverImage: s.coverImage,
      })),
    );

    return shelfSlug ? all.filter((s) => s.shelf === shelfSlug) : all;
  }
  const { createPublicClient } = await import('./supabase/server');
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
  const supabase = createPublicClient();
  /*
   * The shelf join is inner only when a shelf is asked for.
   *
   * It used to be inner always, which made a story with no shelf link
   * disappear from the library, the home page and search-by-shelf while
   * its own page still answered — eleven published, nine on show, and
   * nothing anywhere said why. Saving now refuses to publish without a
   * shelf, but a listing must never hide a published story either way.
   */
  const shelfJoin = shelfSlug
    ? 'story_shelves!inner(is_primary, shelves!inner(slug))'
    : 'story_shelves(is_primary, shelves(slug))';
  let query = supabase
    .from('stories')
    // Note: body_mdx is NOT selected here. Listings never carry story
    // bodies, so a premium body cannot leak through a card.
    .select(`id, slug, title, subtitle, reading_minutes, access, cover_image, view_count, published_at, authors!stories_author_id_fkey(name), story_themes(themes(slug, label)), ${shelfJoin}, story_audio(duration_seconds)`)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (shelfSlug) query = query.eq('story_shelves.shelves.slug', shelfSlug);

  const { data } = await query;

  return (data ?? []).map((r: Record<string, unknown>) => {
    /*
     * The shelf comes from the row, not from the argument.
     *
     * This used to be `shelf: shelfSlug ?? ''`, which meant a story only
     * knew which shelf it was on when the caller had already said so.
     * Called without a filter — by the admin, by the home page, by the
     * related-stories list — every story came back shelf-less, and
     * anything counting or grouping by shelf silently got zero.
     */
    const links = (r.story_shelves ?? []) as {
      is_primary?: boolean;
      shelves: { slug: string } | { slug: string }[] | null;
    }[];
    const link = links.find((l) => l.is_primary) ?? links[0];
    const joined = Array.isArray(link?.shelves) ? link.shelves[0] : link?.shelves;

    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      subtitle: (r.subtitle as string) ?? '',
      author: ((r.authors as { name?: string } | null)?.name) ?? 'Soulfables',
      readingMinutes: (r.reading_minutes as number) ?? 0,
      shelf: joined?.slug ?? shelfSlug ?? '',
      access: (r.access as 'free' | 'premium') ?? 'free',
      coverImage: (r.cover_image as string) ?? null,
      themes: themesOf(r.story_themes),
      views: Number(r.view_count ?? 0),
      publishedAt: (r.published_at as string) ?? null,
      // Live cards never knew they were narrated: the badge read only the
      // demo's list. Now the row says, and how long for.
      ...audioOf(r.story_audio),
    };
  });
}

async function fetchGetProducts(): Promise<Product[]> {
  if (!isConfigured) return PRODUCTS;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data } = await supabase
    .from('products')
    .select('id, slug, title, subtitle, description, kind, eyebrow, pull_quote, cta_label, is_featured, cover_image, product_prices(currency, unit_amount, is_default), product_files(format, file_size_bytes, is_active)')
    .eq('status', 'published')
    .order('sort_order');

  return (data ?? []).map((r: Record<string, unknown>) => {
    const prices = (r.product_prices as { currency: string; unit_amount: number; is_default: boolean }[]) ?? [];
    const price = prices.find((p) => p.is_default) ?? prices[0];
    const files = ((r.product_files as { format: string; file_size_bytes: number | null; is_active: boolean }[]) ?? [])
      .filter((f) => f.is_active !== false)
      .map((f) => ({ format: f.format.toUpperCase(), sizeBytes: f.file_size_bytes ?? null }));
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      subtitle: (r.subtitle as string) ?? '',
      kind: r.kind as string,
      eyebrow: (r.eyebrow as string) ?? '',
      pullQuote: (r.pull_quote as string) ?? '',
      ctaLabel: (r.cta_label as string) ?? 'View',
      priceLabel: price ? formatMoney(price.unit_amount, price.currency) : '',
      price: price ? { unitAmount: price.unit_amount, currency: price.currency } : null,
      description: (r.description as string) ?? null,
      formats: files.map((f) => f.format),
      files,
      featured: Boolean(r.is_featured),
      coverImage: (r.cover_image as string) ?? null,
    };
  });
}

async function fetchGetJourney(shelfSlug: string) {
  let j = JOURNEYS[shelfSlug] ?? { from: [], to: [] };

  if (!isConfigured) {
    const { demoGetShelf } = await import('./demo/editorial');
    const shelf = demoGetShelf(shelfSlug);
    if (shelf) j = { from: shelf.arrivesFrom, to: shelf.continuesTo };
  }

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

  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();

  /*
   * search_stories() (0035) ranks by the weights the vector has always
   * carried, falls back to titles within a typo when nothing matches,
   * and returns what a card needs — cover, shelf, narration — so a
   * result looks like the same story everywhere else. The body is
   * matched against and never returned.
   */
  const { data, error } = await supabase.rpc('search_stories', { p_query: q, p_limit: 50 });

  if (error) {
    console.error('[search]', error.message);
    return [];
  }

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? '',
    author: (r.author_name as string) ?? 'Soulfables',
    readingMinutes: (r.reading_minutes as number) ?? 0,
    shelf: (r.shelf_slug as string) ?? '',
    access: (r.access as 'free' | 'premium') ?? 'free',
    coverImage: (r.cover_image as string) ?? null,
    hasAudio: Boolean(r.has_audio),
    audioMinutes: r.audio_seconds ? Math.max(1, Math.round(Number(r.audio_seconds) / 60)) : null,
  }));
}

/** The narration facts a card carries, from the joined story_audio rows. */
function audioOf(joined: unknown): { hasAudio: boolean; audioMinutes: number | null } {
  const rows = (joined as { duration_seconds?: number | null }[] | null) ?? [];
  if (rows.length === 0) return { hasAudio: false, audioMinutes: null };
  const seconds = rows[0]?.duration_seconds ?? null;
  return { hasAudio: true, audioMinutes: seconds ? Math.max(1, Math.round(seconds / 60)) : null };
}

export type StorySection = { slug: string; title: string };

export type FullStory = StoryCard & {
  /** Parsed from the body, for bookmarks and audio cue points. */
  sections: StorySection[];
  /** Narration, when it exists. `locked`: it is for residents and this reader is not one. */
  audio: {
    src: string;
    narrator: string | null;
    isPlaceholder: boolean;
    generated: boolean;
    locked: boolean;
    /** Why it is locked: for Premium, sign in first, or this month's allowance is spent. */
    reason: 'premium' | 'sign_in' | 'allowance' | null;
    /** Free readers: how many narrated stories they may still start this month. */
    listensLeft: number | null;
    durationSeconds: number | null;
  } | null;
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

// ---------------------------------------------------------------------
// Caching
//
// The database is in Frankfurt and a round trip costs roughly 300ms
// whatever it asks for, so page time is set by how many requests a page
// makes rather than by how heavy they are. Everything below is identical
// for every visitor — the shelves, the published stories, the shop —
// which makes it exactly the kind of thing that should be fetched once
// and shared.
//
// These wrap only the anonymous readers. Anything that depends on WHO is
// asking (a story body, a library, a journal) is deliberately absent: a
// cache keyed on the arguments alone would hand one reader another
// reader's page.
//
// Sixty seconds is short enough that nobody notices staleness and long
// enough to collapse a burst of traffic into one query. Edits do not
// wait for it: the editorial actions call revalidateTag('content').
// ---------------------------------------------------------------------
const CONTENT_TAG = 'content';

export const getShelves = unstable_cache(fetchGetShelves, ['shelves'], {
  revalidate: 60,
  tags: [CONTENT_TAG],
});

export const getStories = unstable_cache(fetchGetStories, ['stories'], {
  revalidate: 60,
  tags: [CONTENT_TAG],
});

export const getProducts = unstable_cache(fetchGetProducts, ['products'], {
  revalidate: 60,
  tags: [CONTENT_TAG],
});

export const getJourney = unstable_cache(fetchGetJourney, ['journey'], {
  revalidate: 60,
  tags: [CONTENT_TAG],
});

export async function getStory(slug: string): Promise<FullStory | null> {
  if (!isConfigured) {
    const row = (await demoStories()).find((s) => s.slug === slug);
    if (!row || row.status !== 'published') return null;

    const card: StoryCard = {
      id: `demo-${row.slug}`,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      author: await demoAuthorName(row.authorSlug),
      readingMinutes: row.readingMinutes,
      shelf: row.shelfSlug,
      access: row.access,
      hasAudio: row.hasAudio,
      coverImage: row.coverImage,
    };

    // The premium rule applies in demo mode too, so the paywall can be
    // demonstrated rather than described — and becoming a Resident
    // actually unlocks it.
    //
    // Only premium stories pay for the membership lookup. Most of the
    // library is free, and a free story should not cost a session read
    // to decide it is free.
    const locked =
      card.access === 'premium' &&
      !(await (await import('./membership')).hasPremiumAccess());

    /*
     * A serialised story reads as its published chapters joined together,
     * in order. Unpublished chapters are left out here rather than hidden
     * in the page — an episode that has not been released has not been
     * written as far as a reader is concerned.
     */
    const body = locked
      ? null
      : row.releaseMode === 'serial'
        ? row.chapters
            .filter((c) => c.status === 'published')
            .sort((a, b) => a.number - b.number)
            .map((c) => `:: ${c.title}\n\n${c.bodyMdx}`)
            .join('\n\n') || null
        : row.bodyMdx || null;

    return {
      ...card,
      locked,
      body,
      sections: body ? sectionsFrom(body) : [],
      // Narration exists for a handful of stories in the demo, so both
      // states — has audio, has none — are visible.
      audio: row.hasAudio
        ? {
            src: '/audio/narration-placeholder.wav',
            narrator: 'Apophia Kamwine',
            isPlaceholder: true,
            generated: false,
            locked: false,
            reason: null,
            listensLeft: null,
            durationSeconds: null,
          }
        : null,
    };
  }

  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();

  /*
   * One request, not three.
   *
   * This was the row, then a premium-access check, then the body —
   * three questions about one story, asked one after another, each about
   * 300ms away. On a reading site the story page cannot be the slowest
   * page, and it was.
   *
   * story_for_reader() (migration 0019) answers all three at once and
   * withholds the prose by exactly the same rule story_body() used. The
   * `locked` flag below still only decides what to RENDER; if it were
   * wrong the function would still have sent no body.
   */
  const { data } = await supabase.rpc('story_for_reader', { p_slug: slug });
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const locked = Boolean(row.locked);
  const body = (row.body as string | null) ?? null;
  const audio = row.audio as {
    narrator?: string;
    duration_seconds?: number;
    generated?: boolean;
    locked?: boolean;
    reason?: 'premium' | 'sign_in' | 'allowance' | null;
    listens_left?: number | null;
  } | null;

  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    subtitle: (row.subtitle as string) ?? '',
    author: (row.author as string) ?? 'Soulfables',
    readingMinutes: (row.reading_minutes as number) ?? 0,
    shelf: (row.shelf as string) ?? '',
    access: (row.access as 'free' | 'premium') ?? 'free',
    coverImage: (row.cover_image as string) ?? null,
    locked,
    earlyAccess: Boolean(row.early_access),
    scheduledFor: (row.scheduled_for as string | null) ?? null,
    // Withheld server-side, not hidden with CSS — and withheld by the
    // database, not only by this line.
    body,
    sections: body ? sectionsFrom(body) : [],
    /*
     * The player asks the narration route, which checks access and signs
     * a short-lived address; the storage key never reaches the page. A
     * narration this reader may not hear still comes through as locked,
     * so the page can say why rather than show nothing.
     */
    audio:
      audio && !locked
        ? {
            src: `/api/story/${row.slug as string}/audio`,
            narrator: audio.narrator ?? null,
            isPlaceholder: false,
            generated: Boolean(audio.generated),
            locked: Boolean(audio.locked),
            reason: audio.reason ?? null,
            listensLeft: typeof audio.listens_left === 'number' ? audio.listens_left : null,
            durationSeconds: audio.duration_seconds ?? null,
          }
        : null,
  };
}

/**
 * The people whose names are on the stories.
 *
 * Public, cached with the rest of the content layer, and it includes
 * House voices — The Librarian belongs on a page introducing who writes
 * here, and the `isPersona` flag lets the page say so rather than
 * implying a person.
 *
 * Story counts come from the same listing the shelves use, so a resident
 * with nothing published reads as nothing published rather than as a
 * missing number.
 */
export type Resident = {
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPersona: boolean;
  storyCount: number;
};

async function fetchResidents(): Promise<Resident[]> {
  const stories = await getStories();
  const count = (name: string) => stories.filter((s) => s.author === name).length;

  if (!isConfigured) {
    const { demoListAuthors } = await import('./demo/editorial');
    return demoListAuthors().map((a) => ({
      slug: a.slug,
      name: a.name,
      bio: a.bio,
      avatarUrl: a.avatarUrl,
      isPersona: a.isPersona,
      storyCount: count(a.name),
    }));
  }

  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('authors')
    .select('slug, name, bio, avatar_url, is_persona')
    .order('sort_order');

  return (data ?? []).map((a: Record<string, unknown>) => ({
    slug: a.slug as string,
    name: a.name as string,
    bio: (a.bio as string) ?? null,
    avatarUrl: (a.avatar_url as string) ?? null,
    isPersona: Boolean(a.is_persona),
    storyCount: count(a.name as string),
  }));
}

export const getResidents = unstable_cache(fetchResidents, ['residents'], {
  revalidate: 60,
  tags: ['content'],
});

/**
 * What is coming: scheduled stories, for Premium readers and staff.
 *
 * Read with the reader's own session and never cached — the answer
 * depends on who is asking. Everyone else gets an empty list, and the
 * database gives them nothing to hide.
 */
export async function getEarlyAccessStories(): Promise<StoryCard[]> {
  if (!isConfigured) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('early_access_stories');
  if (error) {
    console.error('[content] early_access_stories', error.message);
    return [];
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    subtitle: (r.subtitle as string) ?? '',
    author: (r.author_name as string) ?? 'Soulfables',
    readingMinutes: (r.reading_minutes as number) ?? 0,
    shelf: (r.shelf_slug as string) ?? '',
    access: (r.access as 'free' | 'premium') ?? 'free',
    coverImage: (r.cover_image as string) ?? null,
    hasAudio: Boolean(r.has_audio),
    earlyAccess: true,
    scheduledFor: (r.scheduled_for as string | null) ?? null,
  }));
}

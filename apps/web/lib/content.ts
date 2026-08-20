import 'server-only';
import { formatMoney } from './format';

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
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  readingMinutes: number;
  shelf: string;
  access: 'free' | 'premium';
};

export type Product = {
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

const isConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

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
  { slug: 'the-house-after-you-left', title: 'The House After You Left', subtitle: 'A modern folktale about the rooms grief keeps lit', author: 'The Librarian', readingMinutes: 11, shelf: 'heartbreak', access: 'free' },
  { slug: 'the-map-without-my-home', title: 'The Map Without My Home', subtitle: 'A map that still points to the place you left', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'change', access: 'free' },
  { slug: 'the-name-i-left-behind', title: 'The Name I Left Behind', subtitle: 'Leaving a name behind to find who you are', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'change', access: 'free' },
  { slug: 'the-voice-in-the-river', title: 'The Voice in the River', subtitle: 'Finding a new language for life by sitting still long enough to hear what was already there.', author: 'Apophia Kamwine', readingMinutes: 8, shelf: 'healing', access: 'free' },
  { slug: 'the-seed-i-was-afraid-to-plant', title: 'The Seed I Was Afraid to Plant', subtitle: 'Growing glass fruit because you were afraid of bruising.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { slug: 'the-light-that-outlasted', title: 'The Light That Outlasted', subtitle: 'Love that outlasts loss — the kind that stays after the one who carried it is gone.', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'grief', access: 'free' },
  { slug: 'the-house-that-burned-without-fire', title: 'The House That Burned Without Fire', subtitle: 'Grief is not the fire — it is the smoke that lingers after.', author: 'Seren Adair', readingMinutes: 10, shelf: 'grief', access: 'free' },
  { slug: 'the-garden-remembered-me', title: 'The Garden Remembered Me', subtitle: 'The garden held what was planted long after the gardener had gone', author: 'Apophia Kamwine', readingMinutes: 7, shelf: 'healing', access: 'free' },
  { slug: 'the-last-voice-note', title: 'The Last Voice Note', subtitle: 'Some people leave. Their voices don’t.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'grief', access: 'free' },
  { slug: 'the-stranger-in-my-mirror', title: 'The Stranger in My Mirror', subtitle: 'You wake up and realise you have spent years becoming someone everyone else recognises.', author: 'Apophia Kamwine', readingMinutes: 6, shelf: 'change', access: 'free' },
  { slug: 'letters-to-the-tide', title: 'Letters to the Tide', subtitle: 'Words cast to the waves, waiting for a tide that understands.', author: 'Caelum Orr', readingMinutes: 12, shelf: 'heartbreak', access: 'premium' },
  { slug: 'the-sister-who-left-and-returned', title: 'The Sister Who Left and Returned', subtitle: 'Family is not the tie that binds — it is the river that keeps flowing.', author: 'Caelum Orr', readingMinutes: 11, shelf: 'healing', access: 'free' },
];

const PRODUCTS: Product[] = [
  { slug: 'the-version-of-me-you-broke', title: 'The Version Of Me You Broke', subtitle: 'A Soulfables Original by Apophia Kamwine', kind: 'ebook', eyebrow: 'Soulfables Original · New Release', pullQuote: 'You didn’t lose yourself forever. You were waiting to come home.', ctaLabel: 'Come home to yourself', priceLabel: '$7.99', formats: ['EPUB', 'PDF'], featured: true },
  { slug: 'the-soulfables-library', title: 'The Soulfables Library', subtitle: 'Your Complete Sanctuary', kind: 'bundle', eyebrow: 'The Librarian’s Collection', pullQuote: 'Every story, every journal, every reflection — kept together in one library.', ctaLabel: 'Explore the complete library', priceLabel: '$45', formats: ['EPUB', 'PDF'], featured: false },
  { slug: 'heartbreak-anthology', title: 'Heartbreak Anthology', subtitle: 'Stories for the Aftermath', kind: 'anthology', eyebrow: 'Your Signature Collection', pullQuote: 'The collection that introduced thousands of readers to Soulfables.', ctaLabel: 'Begin with heartbreak', priceLabel: '$16', formats: ['EPUB', 'PDF'], featured: false },
  { slug: 'the-soul-journal', title: 'The Soul Journal', subtitle: 'A Companion for Quiet Reflection', kind: 'journal', eyebrow: 'The Everyday Companion', pullQuote: 'A quiet place to write after every story.', ctaLabel: 'Start writing', priceLabel: '$18', formats: ['PDF'], featured: false },
  { slug: 'the-reflection-deck', title: 'The Reflection Deck', subtitle: 'Questions for the Quiet Moments', kind: 'deck', eyebrow: 'The Giftable Experience', pullQuote: '52 questions for the moments that ask something of you.', ctaLabel: 'Draw your first card', priceLabel: '$15', formats: ['PDF'], featured: false },
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
    .select('slug, title, subtitle, reading_minutes, access, authors(name), story_shelves!inner(shelves!inner(slug))')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (shelfSlug) query = query.eq('story_shelves.shelves.slug', shelfSlug);

  const { data } = await query;
  return (data ?? []).map((r: Record<string, unknown>) => ({
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

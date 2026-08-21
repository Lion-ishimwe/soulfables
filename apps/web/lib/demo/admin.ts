import 'server-only';

/**
 * Demo data for the operational side of the admin.
 *
 * Orders, readers, analytics and letters are the screens Soulfables will
 * actually live in, and an admin full of zeroes tells you nothing about
 * whether it is well designed. These are plausible numbers for a young
 * publication — a few hundred readers, single-digit daily sales — not
 * flattering ones, because a dashboard that only looks good at scale is
 * a dashboard that will disappoint on launch day.
 */

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export type DemoOrder = {
  reference: string;
  email: string;
  title: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'refunded' | 'failed';
  createdAt: string;
};

export const DEMO_ORDERS: DemoOrder[] = [
  { reference: 'SF-2026-0014', email: 'thea.mbeki@example.com', title: 'The Version Of Me You Broke', amount: 799, currency: 'USD', status: 'paid', createdAt: daysAgo(0) },
  { reference: 'SF-2026-0013', email: 'j.okonkwo@example.com', title: 'The Soulfables Library', amount: 4500, currency: 'USD', status: 'paid', createdAt: daysAgo(1) },
  { reference: 'SF-2026-0012', email: 'marta.silva@example.com', title: 'The Soul Journal', amount: 1800, currency: 'USD', status: 'paid', createdAt: daysAgo(2) },
  { reference: 'SF-2026-0011', email: 'rk.patel@example.com', title: 'Heartbreak Anthology', amount: 1600, currency: 'USD', status: 'refunded', createdAt: daysAgo(4) },
  { reference: 'SF-2026-0010', email: 'anon@example.com', title: 'The Reflection Deck', amount: 1500, currency: 'USD', status: 'failed', createdAt: daysAgo(5) },
  { reference: 'SF-2026-0009', email: 'l.nakamura@example.com', title: 'The Version Of Me You Broke', amount: 799, currency: 'USD', status: 'paid', createdAt: daysAgo(6) },
  { reference: 'SF-2026-0008', email: 'sam.wright@example.com', title: 'The Version Of Me You Broke', amount: 799, currency: 'USD', status: 'pending', createdAt: daysAgo(7) },
];

export type DemoReader = {
  displayName: string;
  email: string;
  role: 'reader' | 'editor' | 'admin' | 'owner';
  plan: 'free' | 'resident';
  joinedAt: string;
  storiesRead: number;
};

export const DEMO_READERS: DemoReader[] = [
  { displayName: 'Apophia Kamwine', email: 'apophia@soulfables.co', role: 'owner', plan: 'resident', joinedAt: daysAgo(210), storiesRead: 32 },
  { displayName: 'Amara', email: 'reader@soulfables.demo', role: 'owner', plan: 'free', joinedAt: daysAgo(14), storiesRead: 4 },
  { displayName: 'Thea Mbeki', email: 'thea.mbeki@example.com', role: 'reader', plan: 'resident', joinedAt: daysAgo(38), storiesRead: 19 },
  { displayName: 'Joseph Okonkwo', email: 'j.okonkwo@example.com', role: 'reader', plan: 'resident', joinedAt: daysAgo(52), storiesRead: 27 },
  { displayName: 'Marta Silva', email: 'marta.silva@example.com', role: 'reader', plan: 'free', joinedAt: daysAgo(9), storiesRead: 3 },
  { displayName: 'Seren Adair', email: 'seren@soulfables.co', role: 'editor', plan: 'resident', joinedAt: daysAgo(120), storiesRead: 31 },
  { displayName: 'Rahul Patel', email: 'rk.patel@example.com', role: 'reader', plan: 'free', joinedAt: daysAgo(4), storiesRead: 1 },
];

export type DemoEvent = { name: string; count: number; label: string };

/** The events brief §25 asks for, with a fortnight of plausible volume. */
export const DEMO_EVENTS: DemoEvent[] = [
  { name: 'story_opened', count: 1842, label: 'Story opened' },
  { name: 'story_completed', count: 731, label: 'Story completed' },
  { name: 'story_saved', count: 214, label: 'Story saved' },
  { name: 'bookmark_created', count: 96, label: 'Bookmark created' },
  { name: 'passage_kept', count: 148, label: 'Passage kept' },
  { name: 'audio_started', count: 187, label: 'Audio started' },
  { name: 'audio_completed', count: 52, label: 'Audio completed' },
  { name: 'journal_entry_created', count: 163, label: 'Journal entry written' },
  { name: 'book_viewed', count: 402, label: 'Book viewed' },
  { name: 'checkout_started', count: 31, label: 'Checkout started' },
  { name: 'purchase_completed', count: 18, label: 'Purchase completed' },
  { name: 'download_initiated', count: 44, label: 'Download initiated' },
];

/** Daily story opens for the last 14 days, oldest first. */
export const DEMO_DAILY_OPENS: { day: string; opens: number }[] = [
  96, 88, 121, 134, 110, 147, 168, 152, 139, 171, 188, 164, 142, 197,
].map((opens, i, arr) => ({
  day: new Date(Date.now() - (arr.length - 1 - i) * 86_400_000)
    .toISOString()
    .slice(0, 10),
  opens,
}));

export const DEMO_TOP_STORIES = [
  { slug: 'the-house-after-you-left', title: 'The House After You Left', opens: 341, completion: 0.71 },
  { slug: 'the-last-voice-note', title: 'The Last Voice Note', opens: 268, completion: 0.83 },
  { slug: 'the-seed-i-was-afraid-to-plant', title: 'The Seed I Was Afraid to Plant', opens: 204, completion: 0.64 },
  { slug: 'the-stranger-in-my-mirror', title: 'The Stranger in My Mirror', opens: 187, completion: 0.58 },
  { slug: 'the-voice-in-the-river', title: 'The Voice in the River', opens: 155, completion: 0.49 },
];

export type DemoLetter = {
  volume: number;
  number: number;
  slug: string;
  title: string;
  dek: string;
  status: 'published' | 'draft';
  publishedAt: string | null;
  subscribers: number;
  openRate: number | null;
};

export const DEMO_LETTERS: DemoLetter[] = [
  { volume: 1, number: 29, slug: 'letter-29', title: 'On keeping the light on', dek: 'The week of 18 August', status: 'draft', publishedAt: null, subscribers: 0, openRate: null },
  { volume: 1, number: 28, slug: 'letter-28', title: 'A kind of silence that isn’t empty', dek: 'The week of 28 July', status: 'published', publishedAt: daysAgo(24), subscribers: 412, openRate: 0.58 },
  { volume: 1, number: 27, slug: 'letter-27', title: 'What the garden kept', dek: 'The week of 21 July', status: 'published', publishedAt: daysAgo(31), subscribers: 398, openRate: 0.61 },
];

export const DEMO_PROMPTS = [
  { body: 'What part of yourself are you making peace with?', kind: 'daily', uses: 47 },
  { body: 'What is the smallest thing that mends a hole in a heart?', kind: 'daily', uses: 39 },
  { body: 'Who are you still writing letters to in your head?', kind: 'daily', uses: 52 },
  { body: 'What did today ask of you that yesterday could not?', kind: 'daily', uses: 28 },
  { body: 'What are you carrying that was never yours to hold?', kind: 'daily', uses: 61 },
];

export const DEMO_AUDIT = [
  { action: 'story.publish', actor: 'apophia@soulfables.co', entity: 'The Last Voice Note', at: daysAgo(1) },
  { action: 'product_file.upload', actor: 'apophia@soulfables.co', entity: 'The Version Of Me You Broke — EPUB v2', at: daysAgo(3) },
  { action: 'entitlement.grant', actor: 'apophia@soulfables.co', entity: 'thea.mbeki@example.com', at: daysAgo(4) },
  { action: 'story.update', actor: 'seren@soulfables.co', entity: 'The House That Burned Without Fire', at: daysAgo(6) },
  { action: 'user.role_change', actor: 'apophia@soulfables.co', entity: 'seren@soulfables.co → editor', at: daysAgo(12) },
];

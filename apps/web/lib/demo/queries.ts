import 'server-only';
import { getDemoSession } from './store';
import { getDemoSessionId } from './session';
import type { Entry, Mood } from '../journal';
import type { OwnedProduct, ReadingRow } from '../library';

/**
 * Demo implementations of the reader-private reads and writes.
 *
 * These mirror the live functions exactly in shape, so the pages calling
 * them cannot tell which mode they are in. Anything that returns a
 * different type here than lib/journal.ts or lib/library.ts does in live
 * mode is a bug — the demo exists to show the real product, not a
 * lookalike.
 */

export const DEMO_MOODS: Mood[] = [
  { id: 'demo-mood-heartbroken', slug: 'heartbroken', label: 'Heartbroken', emoji: '❤️', shelfSlug: 'heartbreak' },
  { id: 'demo-mood-healing', slug: 'healing', label: 'Healing', emoji: '🌿', shelfSlug: 'healing' },
  { id: 'demo-mood-lost', slug: 'lost', label: 'Lost', emoji: '🌙', shelfSlug: 'anxiety' },
  { id: 'demo-mood-grieving', slug: 'grieving', label: 'Grieving', emoji: '🕊️', shelfSlug: 'grief' },
  { id: 'demo-mood-hopeful', slug: 'hopeful', label: 'Hopeful', emoji: '✨', shelfSlug: 'hope' },
  { id: 'demo-mood-unsure', slug: 'unsure', label: 'Unsure', emoji: '🪞', shelfSlug: null },
];

function moodById(id: string | null) {
  return DEMO_MOODS.find((m) => m.id === id) ?? null;
}

async function session() {
  return getDemoSession(await getDemoSessionId());
}

// ---------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------

export async function demoEntries(
  storyTitleFor: (slug: string) => string | null,
): Promise<Entry[]> {
  const s = await session();

  return s.entries
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((e) => {
      const mood = moodById(e.moodId);
      return {
        id: e.id,
        title: e.title,
        body: e.body,
        createdAt: e.createdAt,
        moodLabel: mood?.label ?? null,
        moodEmoji: mood?.emoji ?? null,
        storySlug: e.storySlug,
        storyTitle: e.storySlug ? storyTitleFor(e.storySlug) : null,
      };
    });
}

export async function demoAddEntry(input: {
  title: string | null;
  body: string;
  moodId: string | null;
  storySlug: string | null;
  aiOptIn: boolean;
}): Promise<string> {
  const s = await session();
  const id = `demo-entry-${Date.now()}`;

  s.entries.unshift({
    id,
    title: input.title,
    body: input.body,
    createdAt: new Date().toISOString(),
    moodId: input.moodId,
    storySlug: input.storySlug,
    aiOptIn: input.aiOptIn,
  });

  return id;
}

export async function demoDeleteEntry(id: string): Promise<void> {
  const s = await session();
  const i = s.entries.findIndex((e) => e.id === id);
  if (i >= 0) s.entries.splice(i, 1);
}

export async function demoSearchEntries(
  query: string,
  storyTitleFor: (slug: string) => string | null,
): Promise<Entry[]> {
  const all = await demoEntries(storyTitleFor);
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return all.filter(
    (e) =>
      e.body.toLowerCase().includes(needle) ||
      (e.title ?? '').toLowerCase().includes(needle),
  );
}

// ---------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------

export async function demoSavedSlugs(): Promise<string[]> {
  const s = await session();
  return [...s.savedStories];
}

export async function demoToggleSaved(slug: string): Promise<boolean> {
  const s = await session();
  if (s.savedStories.has(slug)) {
    s.savedStories.delete(slug);
    return false;
  }
  s.savedStories.add(slug);
  return true;
}

export async function demoRecordProgress(
  slug: string,
  percent: number,
  completed: boolean,
): Promise<void> {
  const s = await session();
  const existing = s.progress.get(slug);

  s.progress.set(slug, {
    storySlug: slug,
    percent,
    lastReadAt: new Date().toISOString(),
    // Finishing is not undone by scrolling back up to reread the opening.
    completedAt:
      existing?.completedAt ?? (completed ? new Date().toISOString() : null),
  });
}

export async function demoReading(
  lookup: (slug: string) => { title: string; subtitle: string; readingMinutes: number } | null,
): Promise<{ inProgress: ReadingRow[]; finished: ReadingRow[] }> {
  const s = await session();

  const rows: ReadingRow[] = [...s.progress.values()]
    .map((p) => {
      const story = lookup(p.storySlug);
      if (!story) return null;
      return {
        slug: p.storySlug,
        title: story.title,
        subtitle: story.subtitle,
        percent: p.percent,
        readingMinutes: story.readingMinutes,
        lastReadAt: p.lastReadAt,
        completedAt: p.completedAt,
      };
    })
    .filter(Boolean) as ReadingRow[];

  rows.sort((a, b) => b.lastReadAt.localeCompare(a.lastReadAt));

  return {
    inProgress: rows.filter((r) => !r.completedAt),
    finished: rows.filter((r) => r.completedAt),
  };
}

export async function demoOwnedProducts(
  lookup: (slug: string) => { title: string; subtitle: string } | null,
): Promise<OwnedProduct[]> {
  const s = await session();

  return [...s.ownedProducts]
    .map((slug) => {
      const product = lookup(slug);
      if (!product) return null;
      return {
        productId: `demo-product-${slug}`,
        slug,
        title: product.title,
        subtitle: product.subtitle,
        coverImage: null,
        source: 'purchase',
        grantedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
        // Two formats, so the multi-format delivery promise is visible.
        files: [
          { id: `demo-file-${slug}-epub`, format: 'EPUB', sizeBytes: 1_180_000 },
          { id: `demo-file-${slug}-pdf`, format: 'PDF', sizeBytes: 3_640_000 },
        ],
      };
    })
    .filter(Boolean) as OwnedProduct[];
}

import 'server-only';
import { getStories, getShelves, getJourney, type StoryCard } from './content';
import { getReading, getSavedStories } from './library';
import { getViewer } from './auth';

/**
 * Recommendations.
 *
 * Deterministic and explainable, as brief §15 asks: content-based first,
 * AI personalisation later. Every suggestion carries the reason it was
 * made, and the reason is shown to the reader — "because you finished The
 * House After You Left" is a better recommendation than the same story
 * with no explanation, even when the story is identical.
 *
 * The scoring reads the journey graph rather than inventing its own
 * notion of similarity. That graph is currently editorial judgement; when
 * there is enough reading data to compute it, this function does not
 * change at all.
 */

export type Recommendation = {
  story: StoryCard;
  reason: string;
  score: number;
};

const WEIGHTS = {
  /** The shelf a finished story sent you on to. Strongest signal. */
  journeyOnward: 5,
  /** Same shelf as something you kept. */
  sharedShelfWithSaved: 3,
  /** Same shelf as something you are part-way through. */
  sharedShelfWithReading: 2,
  /** Same author as something you finished. */
  sameAuthor: 2,
  /** Short enough to read now. A mild nudge, not a thesis. */
  shortRead: 0.5,
} as const;

export async function getRecommendations(limit = 4): Promise<Recommendation[]> {
  const viewer = await getViewer();
  const [stories, shelves] = await Promise.all([getStories(), getShelves()]);

  // Signed out: the Librarian's picks. Not personalised, and not
  // pretending to be.
  if (!viewer) {
    return stories
      .filter((s) => s.access === 'free')
      .slice(0, limit)
      .map((story) => ({
        story,
        reason: 'Chosen by the Librarian for readers arriving today',
        score: 0,
      }));
  }

  const [reading, saved] = await Promise.all([getReading(), getSavedStories()]);

  const finishedSlugs = new Set(reading.finished.map((r) => r.slug));
  const readingSlugs = new Set(reading.inProgress.map((r) => r.slug));
  const savedSlugs = new Set(saved.map((s) => s!.slug));

  // Anything already in front of them is not a recommendation.
  const seen = new Set([...finishedSlugs, ...readingSlugs, ...savedSlugs]);

  const shelfOf = (slug: string) =>
    stories.find((s) => s.slug === slug)?.shelf ?? '';

  // Where finished stories send a reader next.
  const onwardShelves = new Map<string, string>();
  for (const slug of finishedSlugs) {
    const shelf = shelfOf(slug);
    if (!shelf) continue;
    const journey = await getJourney(shelf);
    for (const next of journey.continuesTo) {
      if (!onwardShelves.has(next.slug)) {
        const title = stories.find((s) => s.slug === slug)?.title ?? 'a story';
        onwardShelves.set(next.slug, title);
      }
    }
  }

  const savedShelves = new Set([...savedSlugs].map(shelfOf).filter(Boolean));
  const readingShelves = new Set([...readingSlugs].map(shelfOf).filter(Boolean));
  const finishedAuthors = new Set(
    [...finishedSlugs]
      .map((slug) => stories.find((s) => s.slug === slug)?.author)
      .filter(Boolean) as string[],
  );

  const scored: Recommendation[] = [];

  for (const story of stories) {
    if (seen.has(story.slug)) continue;

    let score = 0;
    let reason = '';

    if (onwardShelves.has(story.shelf)) {
      score += WEIGHTS.journeyOnward;
      const shelfLabel =
        shelves.find((s) => s.slug === story.shelf)?.label ?? 'here';
      reason = `Readers who finished “${onwardShelves.get(story.shelf)}” usually go to ${shelfLabel}`;
    }

    if (savedShelves.has(story.shelf)) {
      score += WEIGHTS.sharedShelfWithSaved;
      reason ||= `From the same shelf as a story you kept`;
    }

    if (readingShelves.has(story.shelf)) {
      score += WEIGHTS.sharedShelfWithReading;
      reason ||= `Near what you are reading now`;
    }

    if (finishedAuthors.has(story.author)) {
      score += WEIGHTS.sameAuthor;
      reason ||= `Also by ${story.author}`;
    }

    if (story.readingMinutes > 0 && story.readingMinutes <= 7) {
      score += WEIGHTS.shortRead;
    }

    if (score > 0) {
      scored.push({ story, reason, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // If nothing scored — a brand new reader — fall back rather than
  // showing an empty shelf.
  if (scored.length === 0) {
    return stories
      .filter((s) => !seen.has(s.slug) && s.access === 'free')
      .slice(0, limit)
      .map((story) => ({
        story,
        reason: 'A good place to begin',
        score: 0,
      }));
  }

  return scored.slice(0, limit);
}

/** "Because you read X" on a story page. Cheap, and needs no session. */
export async function getRelated(
  slug: string,
  limit = 3,
): Promise<StoryCard[]> {
  const stories = await getStories();
  const story = stories.find((s) => s.slug === slug);
  if (!story) return [];

  const sameShelf = stories.filter(
    (s) => s.slug !== slug && s.shelf === story.shelf,
  );

  const journey = story.shelf ? await getJourney(story.shelf) : null;
  const onwardSlugs = new Set(journey?.continuesTo.map((s) => s.slug) ?? []);
  const onward = stories.filter(
    (s) => s.slug !== slug && onwardSlugs.has(s.shelf),
  );

  const sameAuthor = stories.filter(
    (s) => s.slug !== slug && s.author === story.author && s.shelf !== story.shelf,
  );

  // Shelf-mates first, then where the shelf leads, then the author.
  const ordered = [...sameShelf, ...onward, ...sameAuthor];

  const unique: StoryCard[] = [];
  const seen = new Set<string>();
  for (const s of ordered) {
    if (seen.has(s.slug)) continue;
    seen.add(s.slug);
    unique.push(s);
    if (unique.length >= limit) break;
  }

  return unique;
}

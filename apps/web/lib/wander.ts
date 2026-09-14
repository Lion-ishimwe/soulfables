import 'server-only';
import { getStories, getShelves, type StoryCard, type Shelf } from './content';
import { getReading } from './library';
import { getMoods, type Mood } from './journal';
import { getViewer } from './auth';

/**
 * Wander: being handed a story by somebody who has been paying attention.
 *
 * The old page picked one story per hour for everyone, which is a clock
 * and not a librarian. This chooses for the person in front of it, from
 * three things the House already knows:
 *
 *   - what they have read, so nothing is handed back to them;
 *   - which shelves they have not been to, so the House shows its width;
 *   - which stories few people have opened, so the quiet ones get read.
 *
 * And, if they said how the hour feels, the shelf that feeling lives on.
 *
 * Every choice comes with its reason, in a sentence. A recommendation
 * that cannot say why it was made is a lever, and this is not a lever.
 *
 * No model is involved. The rules cost nothing, explain themselves, and
 * are right often enough for a page whose whole promise is "try this".
 */

export type WanderPick = {
  story: StoryCard;
  shelf: Shelf | null;
  reason: string;
  /** The feeling they chose, if any, so the page can keep it selected. */
  mood: Mood | null;
};

export type WanderInput = {
  /** A mood slug from the chips, or nothing. */
  mood?: string | null;
  /** Story slugs already handed over this visit, so "another" means another. */
  seen?: string[];
};

export async function chooseWander(input: WanderInput): Promise<{
  pick: WanderPick | null;
  moods: Mood[];
}> {
  const [stories, shelves, moods, viewer] = await Promise.all([
    getStories(),
    getShelves(),
    getMoods(),
    getViewer(),
  ]);

  const free = stories.filter((s) => s.access === 'free');
  if (free.length === 0) return { pick: null, moods };

  const mood = input.mood ? (moods.find((m) => m.slug === input.mood) ?? null) : null;
  const seen = new Set(input.seen ?? []);

  /*
   * What the reader has already been through. Signed out, the House
   * knows nothing about them and says so by choosing as for a stranger.
   */
  const history = viewer ? await getReading() : { inProgress: [], finished: [] };
  const read = new Set([...history.inProgress, ...history.finished].map((r) => r.slug));
  const shelvesVisited = new Set(
    [...read].map((slug) => free.find((s) => s.slug === slug)?.shelf).filter(Boolean),
  );

  // Fewest opens first, as a tie-breaker and as a kindness to the quiet ones.
  const views = (s: StoryCard) => s.views ?? 0;
  const median = [...free].map(views).sort((a, b) => a - b)[Math.floor(free.length / 2)] ?? 0;

  /*
   * Narrow, then widen only as far as needed. Unread and unseen on the
   * chosen shelf; failing that, unread and unseen anywhere; failing that,
   * anything not handed over this visit. Each widening changes the reason,
   * because the reason has to be true.
   */
  const unseen = free.filter((s) => !seen.has(s.slug));
  const unread = unseen.filter((s) => !read.has(s.slug));
  const onShelf = mood?.shelfSlug ? unread.filter((s) => s.shelf === mood.shelfSlug) : [];

  let pool: StoryCard[];
  let why: 'mood' | 'fresh' | 'again';
  if (mood?.shelfSlug && onShelf.length > 0) {
    pool = onShelf;
    why = 'mood';
  } else if (unread.length > 0) {
    pool = unread;
    why = 'fresh';
  } else if (unseen.length > 0) {
    pool = unseen;
    why = 'again';
  } else {
    pool = free;
    why = 'again';
  }

  /*
   * Score, then choose among the best few rather than the single best:
   * two strangers arriving at the same minute should not be handed the
   * same story, and a reader pressing "another" should feel choice
   * rather than a queue.
   */
  const scored = pool
    .map((s) => ({
      story: s,
      score:
        (viewer && s.shelf && !shelvesVisited.has(s.shelf) ? 2 : 0) +
        (views(s) < median ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || views(a.story) - views(b.story));

  const top = scored.slice(0, Math.min(3, scored.length));
  const chosen = top[Math.floor(Math.random() * top.length)];
  const story = chosen.story;
  const shelf = shelves.find((s) => s.slug === story.shelf) ?? null;

  const reason = (() => {
    if (why === 'mood' && mood && shelf) {
      return `Because you said ${mood.label.toLowerCase()}, and that is what the ${shelf.label} shelf is for.`;
    }
    if (why === 'again') {
      return read.has(story.slug)
        ? 'Because you have read everything here once, and some stories are different the second time.'
        : 'Because you have wandered past everything else, and this one is still waiting.';
    }
    if (viewer && shelf && !shelvesVisited.has(shelf.slug) && read.size > 0) {
      return `Because you have not been to the ${shelf.label} shelf yet.`;
    }
    if (views(story) < median) {
      return 'Because not many people have read this one yet, and it deserves company.';
    }
    if (story.readingMinutes <= 5) {
      return `Because it is short — ${story.readingMinutes} minutes — and short is a good way in.`;
    }
    return 'Because the Librarian thinks it will meet you where you are.';
  })();

  return { pick: { story, shelf, reason, mood }, moods };
}

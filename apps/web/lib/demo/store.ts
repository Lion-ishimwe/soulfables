import 'server-only';

/**
 * In-process demo store.
 *
 * Holds everything a signed-in reader would otherwise have rows for:
 * saved stories, reading progress, journal entries, owned products.
 *
 * Three deliberate properties:
 *
 *   - Keyed by demo session, so two browsers get two separate Houses and
 *     a shared demo link does not show one visitor another's journal.
 *   - Seeded on first touch, so the demo looks lived-in rather than
 *     presenting every screen as an empty state.
 *   - Resets when the server restarts. That is a feature: a demo that
 *     accumulates strangers' text forever is a liability, and nothing
 *     here is worth persisting.
 *
 * When Supabase arrives this file stops being reached. Nothing else has
 * to change, because every caller goes through the same lib/ function in
 * both modes.
 */

export type DemoEntry = {
  id: string;
  title: string | null;
  body: string;
  createdAt: string;
  moodId: string | null;
  storySlug: string | null;
  aiOptIn: boolean;
};

export type DemoProgress = {
  storySlug: string;
  percent: number;
  lastReadAt: string;
  completedAt: string | null;
};

export type DemoBookmark = {
  id: string;
  storySlug: string;
  sectionSlug: string | null;
  sectionTitle: string | null;
  note: string | null;
  createdAt: string;
};

export type DemoPassage = {
  id: string;
  storySlug: string;
  quote: string;
  createdAt: string;
};

export type DemoSession = {
  savedStories: Set<string>;
  progress: Map<string, DemoProgress>;
  entries: DemoEntry[];
  ownedProducts: Set<string>;
  bookmarks: DemoBookmark[];
  passages: DemoPassage[];
  /** Seconds into the narration, per story. Kept apart from reading. */
  listening: Map<string, number>;
  plan: 'free' | 'resident';
};

/**
 * Hung off globalThis rather than kept as a plain module constant.
 *
 * In development Next recompiles and re-instantiates server modules as
 * routes are hit, and each fresh instance would get its own empty Map —
 * so an entry saved on /journal vanished as soon as /story compiled.
 * This is the same pattern used for database clients in Next apps, and
 * for the same reason.
 */
const globalForDemo = globalThis as unknown as {
  __soulfablesDemoSessions?: Map<string, DemoSession>;
};

const sessions =
  globalForDemo.__soulfablesDemoSessions ??
  (globalForDemo.__soulfablesDemoSessions = new Map<string, DemoSession>());

/** Keeps a long-running demo from growing without bound. */
const MAX_SESSIONS = 500;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/**
 * A House that has been lived in for a fortnight.
 *
 * Sample entries are written as a plausible reader, not as marketing
 * copy — the point is to show what the journal looks like with real use,
 * including an entry that is two lines long because that is what most
 * journal entries actually are.
 */
function seed(): DemoSession {
  return {
    savedStories: new Set([
      'the-house-after-you-left',
      'the-last-voice-note',
    ]),

    progress: new Map([
      [
        'the-house-after-you-left',
        {
          storySlug: 'the-house-after-you-left',
          percent: 1,
          lastReadAt: daysAgo(2),
          completedAt: daysAgo(2),
        },
      ],
      [
        'the-seed-i-was-afraid-to-plant',
        {
          storySlug: 'the-seed-i-was-afraid-to-plant',
          percent: 0.41,
          lastReadAt: daysAgo(1),
          completedAt: null,
        },
      ],
      [
        'the-voice-in-the-river',
        {
          storySlug: 'the-voice-in-the-river',
          percent: 0.68,
          lastReadAt: daysAgo(5),
          completedAt: null,
        },
      ],
    ]),

    entries: [
      {
        id: 'demo-entry-1',
        title: null,
        body: 'Read the one about the house tonight. The bit about the kettle boiling for one got me in a way I was not expecting on a Tuesday.\n\nI have been doing the thing where I keep the hallway light on. I did not know that was a recognisable thing that people do.',
        createdAt: daysAgo(2),
        moodId: 'demo-mood-grieving',
        storySlug: 'the-house-after-you-left',
        aiOptIn: false,
      },
      {
        id: 'demo-entry-2',
        title: 'Small list',
        body: 'Things I am making peace with:\n\n— that it was not one big decision, it was four hundred small ones\n— that I am allowed to have liked some of it\n— the mint',
        createdAt: daysAgo(6),
        moodId: 'demo-mood-healing',
        storySlug: null,
        aiOptIn: false,
      },
      {
        id: 'demo-entry-3',
        title: null,
        body: 'Nothing today. Just wanted to open the page.',
        createdAt: daysAgo(9),
        moodId: 'demo-mood-unsure',
        storySlug: null,
        aiOptIn: false,
      },
    ],

    // The demo reader owns the flagship ebook, so My Library has
    // something in it and the download control is visible.
    ownedProducts: new Set(['the-version-of-me-you-broke']),

    bookmarks: [
      {
        id: 'demo-bm-1',
        storySlug: 'the-house-after-you-left',
        sectionSlug: 'the-lamp-by-the-door',
        sectionTitle: 'The Lamp by the Door',
        note: 'Come back to this bit.',
        createdAt: daysAgo(2),
      },
    ],

    passages: [
      {
        id: 'demo-pass-1',
        storySlug: 'the-house-after-you-left',
        quote:
          'Grief is not the fire. It is the smoke that lingers after, in the curtains, in the coats, in every room that has to learn a new arithmetic.',
        createdAt: daysAgo(2),
      },
    ],

    listening: new Map([['the-voice-in-the-river', 42]]),

    // Free by default, so the paywall and the upgrade path are both
    // demonstrable. Switchable from the membership page.
    plan: 'free',
  };
}

export function getDemoSession(sessionId: string): DemoSession {
  let session = sessions.get(sessionId);

  if (!session) {
    // Cheapest possible eviction: when full, drop the oldest key. Demo
    // sessions are disposable and this is not worth an LRU.
    if (sessions.size >= MAX_SESSIONS) {
      const oldest = sessions.keys().next().value;
      if (oldest) sessions.delete(oldest);
    }
    session = seed();
    sessions.set(sessionId, session);
  }

  return session;
}

export function resetDemoSession(sessionId: string): void {
  sessions.set(sessionId, seed());
}

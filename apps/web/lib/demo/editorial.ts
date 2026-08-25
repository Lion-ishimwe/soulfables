import 'server-only';

/**
 * Editorial content the admin can actually change, in demo mode.
 *
 * Distinct from lib/demo/store.ts on purpose. That store is per reader —
 * your saved stories, your journal — and is keyed by a session cookie.
 * This one is the House's own content: shelves, authors, and what the
 * front door features. It is shared, because editorial work is not
 * private to whoever happens to be signed in.
 *
 * Hung off globalThis for the same reason the reader store is: Next
 * re-instantiates server modules as routes compile in development, and a
 * plain module constant would reset the moment another route was hit.
 *
 * It resets when the server restarts. That is the honest limit of a demo
 * without a database — the writes are real while the process lives, and
 * the same admin actions write to Postgres the moment credentials exist.
 */

export type EditorialShelf = {
  slug: string;
  label: string;
  title: string;
  emoji: string;
  tagline: string;
  librarianNote: string | null;
  /** Slug of the story shown under "Begin here". */
  entryStorySlug: string | null;
  accentColor: string | null;
  sortOrder: number;
  status: 'draft' | 'published';
  /** Where readers usually arrive from, and go on to. Shelf slugs. */
  arrivesFrom: string[];
  continuesTo: string[];
};

export type EditorialAuthor = {
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  /** "The Librarian" is a House voice, not a person. */
  isPersona: boolean;
  sortOrder: number;
};


export type EditorialChapter = {
  id: string;
  number: number;
  title: string;
  bodyMdx: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
};

export type EditorialStory = {
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  bodyMdx: string;
  authorSlug: string | null;
  /** Who is writing it now — may differ from the byline. */
  assignedAuthorSlug: string | null;
  shelfSlug: string;
  access: 'free' | 'premium';
  status: 'draft' | 'in_review' | 'published' | 'archived';
  releaseMode: 'full' | 'serial';
  chapters: EditorialChapter[];
  coverImage: string | null;
  readingMinutes: number;
  publishedAt: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  revisionNote: string | null;
  hasAudio: boolean;
};

/** An author who can sign in and write. */
export type AuthorAccount = {
  email: string;
  authorSlug: string;
  invitedAt: string;
};

export type Notification = {
  id: string;
  /** Author slug, since the demo has no real user ids. */
  forAuthor: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type FeaturedSlot = {
  id: string;
  placement: 'home_hero' | 'librarian_pick' | 'shop_hero' | 'shelf_spotlight';
  entityType: 'story' | 'shelf' | 'product' | 'letter';
  entitySlug: string;
  headline: string | null;
  blurb: string | null;
  sortOrder: number;
  active: boolean;
};

type Editorial = {
  shelves: EditorialShelf[];
  authors: EditorialAuthor[];
  featured: FeaturedSlot[];
  stories: EditorialStory[];
  accounts: AuthorAccount[];
  notifications: Notification[];
};

function seed(): Editorial {
  const shelf = (
    slug: string,
    label: string,
    title: string,
    emoji: string,
    tagline: string,
    sortOrder: number,
    extra: Partial<EditorialShelf> = {},
  ): EditorialShelf => ({
    slug,
    label,
    title,
    emoji,
    tagline,
    librarianNote: null,
    entryStorySlug: null,
    accentColor: null,
    sortOrder,
    status: 'published',
    arrivesFrom: [],
    continuesTo: [],
    ...extra,
  });

  return {
    shelves: [
      shelf('heartbreak', 'Heartbreak', 'Stories About Heartbreak', '❤️',
        'Love, loss, and the slow art of letting go.', 0, {
          librarianNote:
            'Stay as long as you need. But don’t forget the Healing shelf exists — readers rarely stay here forever. They usually leave carrying Hope.',
          entryStorySlug: 'the-house-after-you-left',
          arrivesFrom: ['grief', 'love', 'loneliness'],
          continuesTo: ['healing', 'hope', 'forgiveness'],
        }),
      shelf('healing', 'Healing', 'Stories About Healing', '🌿',
        'The quiet work that happens after the worst of it.', 1, {
          arrivesFrom: ['heartbreak', 'grief'],
          continuesTo: ['hope', 'change'],
        }),
      shelf('anxiety', 'Sleepless', 'Stories for the Sleepless', '🌙',
        'For the nights the mind will not put itself down.', 2, {
          continuesTo: ['healing'],
        }),
      shelf('change', 'New Beginnings', 'Stories About Beginning Again', '🌊',
        'What it costs to start, and what it gives back.', 3, {
          continuesTo: ['hope'],
        }),
      shelf('love', 'Love', 'Stories About Love', '💛',
        'In all the shapes it arrives in.', 4),
      shelf('loneliness', 'Loneliness', 'Stories About Loneliness', '🕯️',
        'Company for the hours that have none.', 5, {
          continuesTo: ['heartbreak', 'hope'],
        }),
      shelf('grief', 'Grief', 'Stories About Grief', '🕊️',
        'For what stays after someone goes.', 6, {
          continuesTo: ['heartbreak', 'healing'],
        }),
      shelf('hope', 'Hope', 'Stories About Hope', '✨',
        'Quiet, stubborn, and usually early.', 7),
      shelf('forgiveness', 'Forgiveness', 'Stories About Forgiveness', '🤍',
        'Including the hardest one, which is yourself.', 8),
    ],

    authors: [
      {
        slug: 'apophia-kamwine',
        name: 'Apophia Kamwine',
        bio: 'Founder of Soulfables. Writes modern folktales about love, loss, and becoming.',
        avatarUrl: null,
        isPersona: false,
        sortOrder: 0,
      },
      {
        slug: 'the-librarian',
        name: 'The Librarian',
        bio: 'The keeper of the House. Chooses what you read before you know you need it.',
        avatarUrl: null,
        isPersona: true,
        sortOrder: 1,
      },
      {
        slug: 'seren-adair',
        name: 'Seren Adair',
        bio: null,
        avatarUrl: null,
        isPersona: false,
        sortOrder: 2,
      },
      {
        slug: 'caelum-orr',
        name: 'Caelum Orr',
        bio: null,
        avatarUrl: null,
        isPersona: false,
        sortOrder: 3,
      },
    ],

    stories: [],
    accounts: [
      {
        email: 'seren@soulfables.co',
        authorSlug: 'seren-adair',
        invitedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
      },
    ],
    notifications: [],

    featured: [
      {
        id: 'feat-1',
        placement: 'home_hero',
        entityType: 'story',
        entitySlug: 'the-house-after-you-left',
        headline: 'The Librarian chose this for you today',
        blurb: null,
        sortOrder: 0,
        active: true,
      },
      {
        id: 'feat-2',
        placement: 'shop_hero',
        entityType: 'product',
        entitySlug: 'the-version-of-me-you-broke',
        headline: 'Soulfables Original · New Release',
        blurb: null,
        sortOrder: 0,
        active: true,
      },
    ],
  };
}

const globalForEditorial = globalThis as unknown as {
  __soulfablesEditorial?: Editorial;
};

function store(): Editorial {
  return (globalForEditorial.__soulfablesEditorial ??=
    globalForEditorial.__soulfablesEditorial ?? seed());
}

// ---------------------------------------------------------------------
// Shelves
// ---------------------------------------------------------------------

export function demoListShelves(): EditorialShelf[] {
  return [...store().shelves].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function demoGetShelf(slug: string): EditorialShelf | null {
  return store().shelves.find((s) => s.slug === slug) ?? null;
}

export function demoSaveShelf(
  original: string | null,
  next: EditorialShelf,
): { error?: string } {
  const s = store();
  const clash = s.shelves.find(
    (x) => x.slug === next.slug && x.slug !== original,
  );
  if (clash) return { error: 'Another shelf already uses that web address.' };

  const i = original ? s.shelves.findIndex((x) => x.slug === original) : -1;
  if (i >= 0) s.shelves[i] = next;
  else s.shelves.push(next);

  return {};
}

export function demoDeleteShelf(slug: string): void {
  const s = store();
  s.shelves = s.shelves.filter((x) => x.slug !== slug);
  // A journey may not point at a shelf that no longer exists.
  for (const shelf of s.shelves) {
    shelf.arrivesFrom = shelf.arrivesFrom.filter((x) => x !== slug);
    shelf.continuesTo = shelf.continuesTo.filter((x) => x !== slug);
  }
}

// ---------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------

export function demoListAuthors(): EditorialAuthor[] {
  return [...store().authors].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function demoGetAuthor(slug: string): EditorialAuthor | null {
  return store().authors.find((a) => a.slug === slug) ?? null;
}

export function demoSaveAuthor(
  original: string | null,
  next: EditorialAuthor,
): { error?: string } {
  const s = store();
  const clash = s.authors.find(
    (x) => x.slug === next.slug && x.slug !== original,
  );
  if (clash) return { error: 'Another author already uses that web address.' };

  const i = original ? s.authors.findIndex((x) => x.slug === original) : -1;
  if (i >= 0) s.authors[i] = next;
  else s.authors.push(next);

  return {};
}

export function demoDeleteAuthor(slug: string): void {
  const s = store();
  s.authors = s.authors.filter((a) => a.slug !== slug);
}

// ---------------------------------------------------------------------
// Featured
// ---------------------------------------------------------------------

export function demoListFeatured(): FeaturedSlot[] {
  return [...store().featured].sort(
    (a, b) => a.placement.localeCompare(b.placement) || a.sortOrder - b.sortOrder,
  );
}

export function demoSaveFeatured(slot: FeaturedSlot): void {
  const s = store();
  const i = s.featured.findIndex((f) => f.id === slot.id);
  if (i >= 0) s.featured[i] = slot;
  else s.featured.push(slot);
}

export function demoDeleteFeatured(id: string): void {
  const s = store();
  s.featured = s.featured.filter((f) => f.id !== id);
}

// ---------------------------------------------------------------------
// Stories
//
// Seeded lazily from the demo constants the first time they are asked
// for, so the published library exists without duplicating it here, and
// anything written or edited afterwards lives in this store.
// ---------------------------------------------------------------------

let storiesSeeded = false;

export function demoSeedStories(
  seedFrom: () => Omit<EditorialStory, 'chapters'>[],
): void {
  const s = store();
  if (storiesSeeded || s.stories.length > 0) return;
  s.stories = seedFrom().map((st) => ({ ...st, chapters: [] }));
  storiesSeeded = true;
}

export function demoListStories(): EditorialStory[] {
  return [...store().stories];
}

export function demoGetStory(slug: string): EditorialStory | null {
  return store().stories.find((s) => s.slug === slug) ?? null;
}

export function demoSaveStory(
  original: string | null,
  next: EditorialStory,
): { error?: string } {
  const s = store();
  if (s.stories.some((x) => x.slug === next.slug && x.slug !== original)) {
    return { error: 'Another story already uses that web address.' };
  }

  const i = original ? s.stories.findIndex((x) => x.slug === original) : -1;
  if (i >= 0) s.stories[i] = next;
  else s.stories.unshift(next);

  return {};
}

export function demoDeleteStory(slug: string): void {
  const s = store();
  s.stories = s.stories.filter((x) => x.slug !== slug);
}

/** Chapters, for a serialised story. */
export function demoSaveChapter(
  storySlug: string,
  chapter: EditorialChapter,
): void {
  const story = demoGetStory(storySlug);
  if (!story) return;
  const i = story.chapters.findIndex((c) => c.id === chapter.id);
  if (i >= 0) story.chapters[i] = chapter;
  else story.chapters.push(chapter);
  story.chapters.sort((a, b) => a.number - b.number);
}

export function demoDeleteChapter(storySlug: string, id: string): void {
  const story = demoGetStory(storySlug);
  if (!story) return;
  story.chapters = story.chapters.filter((c) => c.id !== id);
}

// ---------------------------------------------------------------------
// Author accounts
// ---------------------------------------------------------------------

export function demoListAccounts(): AuthorAccount[] {
  return [...store().accounts];
}

export function demoAccountFor(email: string): AuthorAccount | null {
  const needle = email.trim().toLowerCase();
  return store().accounts.find((a) => a.email.toLowerCase() === needle) ?? null;
}

export function demoCreateAccount(
  account: AuthorAccount,
): { error?: string } {
  const s = store();
  if (demoAccountFor(account.email)) {
    return { error: 'That address already has an author account.' };
  }
  if (s.accounts.some((a) => a.authorSlug === account.authorSlug)) {
    return { error: 'That author already has an account.' };
  }
  s.accounts.push(account);
  return {};
}

export function demoRevokeAccount(email: string): void {
  const s = store();
  const needle = email.trim().toLowerCase();
  s.accounts = s.accounts.filter((a) => a.email.toLowerCase() !== needle);
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------

export function demoNotify(
  n: Omit<Notification, 'id' | 'createdAt' | 'readAt'>,
): void {
  store().notifications.unshift({
    ...n,
    id: `note-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

export function demoNotifications(authorSlug: string): Notification[] {
  return store()
    .notifications.filter((n) => n.forAuthor === authorSlug)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function demoMarkNotificationsRead(authorSlug: string): void {
  const now = new Date().toISOString();
  for (const n of store().notifications) {
    if (n.forAuthor === authorSlug && !n.readAt) n.readAt = now;
  }
}

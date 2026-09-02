import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getShelves, getStories, type StoryCard } from '@/lib/content';
import { getFeatured, applyOrder } from '@/lib/featured';
import { LibraryBackdrop } from '@/components/library-backdrop';
import { StoryTile, StoryListRow } from '@/components/library/story-tile';
import { LibraryControls } from '@/components/library/controls';
import { ShelfChips, ViewToggle } from '@/components/library/filters';
import { Pagination } from '@/components/library/pagination';

export const metadata: Metadata = {
  title: 'The Library',
  description:
    'Every Soulfables folktale, arranged by the feeling that brings people to it.',
  alternates: { canonical: '/library' },
};

export const revalidate = 300;

const PER_PAGE = 12;

/*
 * Newest first is the default, and it is the one the House can arrange by
 * hand: Settings → Featured → "Library — what comes first" leads this
 * view. Choosing any other sort is the reader saying they would rather
 * decide for themselves, so the curation steps out of the way.
 */
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'quickest', label: 'Quickest read' },
  { value: 'longest', label: 'Longest read' },
  { value: 'title', label: 'A – Z' },
];

type Params = {
  shelf?: string;
  q?: string;
  sort?: string;
  view?: string;
  page?: string;
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const [params, all, shelves, placed] = await Promise.all([
    searchParams,
    getStories(),
    getShelves(),
    getFeatured('library_order'),
  ]);

  const shelf = params.shelf ?? '';
  const q = (params.q ?? '').trim();
  const sort = SORTS.some((s) => s.value === params.sort) ? params.sort! : 'newest';
  const view: 'grid' | 'list' = params.view === 'list' ? 'list' : 'grid';
  const page = Math.max(1, Number(params.page) || 1);

  /** Every link on this page keeps the filters you already set. */
  const link = (next: Partial<Params>): string => {
    const merged: Params = { shelf, q, sort, view, page: String(page), ...next };
    const query = new URLSearchParams();

    // Defaults are left out, so the plain /library stays a clean URL and
    // does not turn into ?shelf=&q=&sort=newest&view=grid&page=1.
    if (merged.shelf) query.set('shelf', merged.shelf);
    if (merged.q) query.set('q', merged.q);
    if (merged.sort && merged.sort !== 'newest') query.set('sort', merged.sort);
    if (merged.view && merged.view !== 'grid') query.set('view', merged.view);
    if (merged.page && merged.page !== '1') query.set('page', merged.page);

    const s = query.toString();
    return s ? `/library?${s}` : '/library';
  };

  // ---- Filter ------------------------------------------------------
  let stories = shelf ? all.filter((s) => s.shelf === shelf) : all;

  if (q) {
    /*
     * Matched here rather than in the database on purpose. getStories()
     * is already cached for everybody, and searching the list it returns
     * costs nothing — where a query per keystroke-shaped URL would cost a
     * round trip to Frankfurt each time. Themes are searched too, so
     * "grief" finds the stories about it as well as the shelf named for
     * it.
     */
    const needle = q.toLowerCase();
    const hit = (s: StoryCard) =>
      [s.title, s.subtitle, s.author, ...(s.themes ?? []).map((t) => t.label)]
        .join(' ')
        .toLowerCase()
        .includes(needle);

    stories = stories.filter(hit);
  }

  // ---- Sort --------------------------------------------------------
  const when = (s: StoryCard) => s.publishedAt ?? '';

  if (sort === 'oldest') {
    stories = [...stories].sort((a, b) => when(a).localeCompare(when(b)));
  } else if (sort === 'quickest') {
    stories = [...stories].sort((a, b) => a.readingMinutes - b.readingMinutes);
  } else if (sort === 'longest') {
    stories = [...stories].sort((a, b) => b.readingMinutes - a.readingMinutes);
  } else if (sort === 'title') {
    stories = [...stories].sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // getStories() already returns newest first; the House's picks lead.
    stories = applyOrder(stories, placed);
  }

  // ---- Page --------------------------------------------------------
  const total = stories.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PER_PAGE;
  const shown = stories.slice(start, start + PER_PAGE);

  const activeShelf = shelves.find((s) => s.slug === shelf);
  const filtered = Boolean(q || shelf);

  return (
    <>
      {/* ---- Hero ---------------------------------------------------- */}
      <header className="relative overflow-hidden border-b border-rule">
        {/*
          The drawn library, pushed to the right and faded into the page.
          It is atmosphere behind the type, so it is aria-hidden and it
          disappears on a phone, where there is no room to the side and it
          would only sit under the words.
        */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] md:block">
          <LibraryBackdrop />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" />
        </div>

        <div className="relative mx-auto max-w-page px-5 pb-12 pt-16 sm:px-8 sm:pb-14 sm:pt-20">
          <p className="sf-eyebrow">The Library</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl lg:text-6xl">
            {activeShelf ? activeShelf.label : 'All Stories'}
          </h1>
          <p className="mt-4 max-w-md text-base leading-normal text-grey-muted">
            {activeShelf
              ? activeShelf.tagline
              : `${all.length} ${all.length === 1 ? 'folktale' : 'folktales'} across ${shelves.length} shelves. Find the one that meets you where you are.`}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-page px-5 sm:px-8">
        {/* ---- Shelves ----------------------------------------------- */}
        <div className="py-7">
          <ShelfChips
            shelves={shelves}
            active={shelf}
            // Changing shelf starts at page one; staying on page 4 of a
            // shelf you have just left is nobody's intention.
            href={(next) => link({ shelf: next, page: '1' })}
          />
        </div>

        {/* ---- Search, sort, layout ---------------------------------- */}
        <div className="flex flex-wrap items-center gap-3 border-t border-rule py-5">
          <div className="min-w-0 flex-1">
            <LibraryControls
              action="/library"
              q={q}
              sort={sort}
              hidden={{ ...(shelf ? { shelf } : {}), ...(view !== 'grid' ? { view } : {}) }}
              sorts={SORTS}
            />
          </div>
          <ViewToggle view={view} href={(next) => link({ view: next })} />
        </div>

        {/* ---- Results ----------------------------------------------- */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 pb-6">
          <p className="font-ui text-sm text-grey-muted">
            {total === 0
              ? 'Nothing found'
              : `${total} ${total === 1 ? 'story' : 'stories'} found`}
            {q && <span className="text-grey-faint"> for “{q}”</span>}
          </p>
          {filtered && (
            <Link
              href={'/library' as Route}
              className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
            >
              Clear filters
            </Link>
          )}
        </div>

        {total === 0 ? (
          <div className="rounded-lg border border-rule bg-ink-raised px-8 py-16 text-center">
            <p className="font-display text-2xl text-ivory">
              Nothing here matches that.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-normal text-grey-muted">
              Try a different word, or walk the shelves instead — each one
              holds a different kind of truth.
            </p>
            <Link
              href={'/shelves' as Route}
              className="mt-6 inline-block rounded-lg border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
            >
              Browse shelves →
            </Link>
          </div>
        ) : view === 'list' ? (
          <ul className="divide-y divide-rule overflow-hidden rounded-lg border border-rule bg-ink-raised">
            {shown.map((story) => (
              <li key={story.slug}>
                <StoryListRow story={story} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((story) => (
              <li key={story.slug}>
                <StoryTile story={story} />
              </li>
            ))}

            {/*
              The nudge sits in the grid rather than after it, filling the
              gap a row of three leaves behind. On the last page only —
              earlier pages have no gap, and repeating it under every page
              would make it furniture nobody sees.
            */}
            {current === pages && (
              <li>
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gold/25 bg-gold-dim/40 px-6 py-10 text-center">
                  <span aria-hidden="true" className="text-lg text-gold">
                    ✦
                  </span>
                  <p className="mt-3 font-display text-xl font-light leading-snug text-ivory">
                    Can’t find what you’re looking for?
                  </p>
                  <p className="mt-2.5 text-sm leading-normal text-grey-muted">
                    Explore stories by shelf — each one holds a different kind
                    of truth.
                  </p>
                  <Link
                    href={'/shelves' as Route}
                    className="mt-5 rounded-lg border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
                  >
                    Browse shelves →
                  </Link>
                </div>
              </li>
            )}
          </ul>
        )}

        {/* ---- Pages ------------------------------------------------- */}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-4 py-10 sm:justify-between">
            <span className="hidden font-ui text-xs text-grey-muted sm:block sm:w-40">
              {/* Balances the row so the numbers sit centred. */}
            </span>
            <Pagination
              page={current}
              pages={pages}
              href={(n) => link({ page: String(n) })}
            />
            <p className="font-ui text-xs text-grey-muted sm:w-40 sm:text-right">
              Showing {start + 1} – {Math.min(start + PER_PAGE, total)} of {total}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { listWorkStories, listAdminAuthors, listAdminShelves, type WorkStory } from '@/lib/admin-data';
import { PageHeader, StatusPill, EmptyState } from '@/components/admin/ui';
import { KebabMenu, type KebabItem } from '@/components/admin/kebab-menu';
import { AdminStoryTile } from '@/components/admin/story-tile';
import { StoriesToolbar, PerPage } from '@/components/admin/stories-toolbar';
import { ViewToggle } from '@/components/library/filters';
import { Pagination } from '@/components/library/pagination';
import { ThemeChips } from '@/components/theme-chips';
import { ReassignForm } from '@/components/admin/reassign-form';
import { approveStory, discardStory } from '@/app/actions/workflow';
import { formatDate, formatCount } from '@/lib/format';

export const metadata: Metadata = { title: 'Stories' };
export const dynamic = 'force-dynamic';

/*
 * Every story, in whatever state.
 *
 * The page used to be one table of everything, ordered by urgency, which
 * worked while there were eleven stories and stops working at a hundred.
 * So: tabs for the state you are working in, filters for the rest, and
 * two layouts — cards when you are looking through the House's work, the
 * table when you are checking a column down forty rows.
 *
 * All of it lives in the URL. Nothing here holds client state, so what
 * you see is what the server decided, and a view worth returning to is a
 * link.
 */

const TABS = [
  { value: 'all', label: 'All stories' },
  { value: 'in_review', label: 'In review' },
  { value: 'draft', label: 'Drafts' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const READ_TIMES = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5 – 10 min' },
  { value: 'long', label: 'Over 10 min' },
];

type Params = {
  tab?: string;
  q?: string;
  shelf?: string;
  author?: string;
  read?: string;
  view?: string;
  page?: string;
  per?: string;
  saved?: string;
  deleted?: string;
};

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const [params, stories, authors, shelves] = await Promise.all([
    searchParams,
    listWorkStories(),
    listAdminAuthors(),
    listAdminShelves(),
  ]);

  const tab = TABS.some((t) => t.value === params.tab) ? params.tab! : 'all';
  const q = (params.q ?? '').trim();
  const shelf = params.shelf ?? '';
  const author = params.author ?? '';
  const read = READ_TIMES.some((r) => r.value === params.read) ? params.read! : '';
  const view: 'grid' | 'list' = params.view === 'list' ? 'list' : 'grid';
  const per = [12, 16, 24, 48].includes(Number(params.per)) ? Number(params.per) : 16;
  const page = Math.max(1, Number(params.page) || 1);

  /** Every control on this page keeps the others' settings. */
  const link = (next: Partial<Params>): string => {
    const merged: Params = {
      tab, q, shelf, author, read, view,
      page: String(page), per: String(per),
      ...next,
    };
    const query = new URLSearchParams();
    if (merged.tab && merged.tab !== 'all') query.set('tab', merged.tab);
    if (merged.q) query.set('q', merged.q);
    if (merged.shelf) query.set('shelf', merged.shelf);
    if (merged.author) query.set('author', merged.author);
    if (merged.read) query.set('read', merged.read);
    if (merged.view && merged.view !== 'grid') query.set('view', merged.view);
    if (merged.per && merged.per !== '16') query.set('per', merged.per);
    if (merged.page && merged.page !== '1') query.set('page', merged.page);

    const s = query.toString();
    return s ? `/admin/stories?${s}` : '/admin/stories';
  };

  // ---- Counts, before filtering, so a tab always says how many are in it
  const countFor = (value: string) =>
    value === 'all' ? stories.length : stories.filter((s) => s.status === value).length;

  // ---- Filter ------------------------------------------------------
  let rows = tab === 'all' ? stories : stories.filter((s) => s.status === tab);

  if (shelf) rows = rows.filter((s) => s.shelfSlug === shelf);
  if (author) {
    // Byline or assignment — an editor looking for "Caelum's stories"
    // means both the ones with his name on and the ones he is writing.
    rows = rows.filter(
      (s) => s.authorSlug === author || s.assignedAuthorSlug === author,
    );
  }
  if (read) {
    rows = rows.filter((s) =>
      read === 'short'
        ? s.readingMinutes < 5
        : read === 'medium'
          ? s.readingMinutes >= 5 && s.readingMinutes <= 10
          : s.readingMinutes > 10,
    );
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((s) =>
      [
        s.title, s.subtitle, s.excerpt,
        s.authorName ?? '', s.assignedName ?? '', s.shelfLabel ?? '',
        ...s.themes.map((t) => t.label),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }

  /*
   * Anything waiting on the House first, then drafts, then the library.
   * Kept from the old page: the point of opening this is usually to find
   * what needs you, and sorting alphabetically buries it.
   */
  const ordered = [...rows].sort((a, b) => {
    const rank = (s: WorkStory) =>
      s.status === 'in_review' ? 0 : s.status === 'draft' ? 1 : 2;
    return rank(a) - rank(b) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  // ---- Page --------------------------------------------------------
  const total = ordered.length;
  const pages = Math.max(1, Math.ceil(total / per));
  const current = Math.min(page, pages);
  const start = (current - 1) * per;
  const shown = ordered.slice(start, start + per);

  const writers = authors.filter((a) => !a.isPersona).map((a) => ({ slug: a.slug, name: a.name }));

  /** The same menu whether the story is a card or a table row. */
  const menuFor = (s: WorkStory): KebabItem[] => [
    { kind: 'link', label: 'Edit story', href: `/admin/stories/${s.slug}` as Route },
    { kind: 'link', label: 'Open in the studio', href: `/studio/${s.slug}` as Route },
    ...(s.status === 'published'
      ? [{ kind: 'link' as const, label: 'View on site', href: `/story/${s.slug}` as Route }]
      : []),
    ...(s.status === 'in_review'
      ? [
          {
            kind: 'action' as const,
            label: 'Approve and publish',
            action: approveStory,
            fields: { slug: s.slug },
          },
        ]
      : []),
    {
      kind: 'action',
      label: 'Delete story',
      action: discardStory,
      fields: { slug: s.slug },
      danger: true,
      confirm: `Delete “${s.title}”?`,
      confirmBody:
        'The story, its chapters and everything readers saved against it go with it. This cannot be undone.',
      confirmWord: 'delete',
    },
  ];

  const filtered = Boolean(q || shelf || author || read);
  const carried = {
    ...(tab !== 'all' ? { tab } : {}),
    ...(view !== 'grid' ? { view } : {}),
    ...(per !== 16 ? { per: String(per) } : {}),
  };

  return (
    <>
      <PageHeader
        title="Stories"
        subtitle="Everything written, submitted or published."
        action={{ href: '/admin/stories/new', label: 'New story' }}
      />

      {params.saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Saved “{params.saved}”.
        </p>
      )}
      {params.deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          Story deleted.
        </p>
      )}

      {/* ---- Tabs ---------------------------------------------------- */}
      <nav aria-label="Filter by state" className="mb-5 border-b border-rule">
        <ul className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const on = t.value === tab;
            const n = countFor(t.value);
            return (
              <li key={t.value}>
                <Link
                  href={link({ tab: t.value, page: '1' }) as Route}
                  aria-current={on ? 'page' : undefined}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 font-ui text-sm transition-colors ${
                    on
                      ? 'border-gold text-gold'
                      : 'border-transparent text-grey-muted hover:text-ivory'
                  }`}
                >
                  {t.label}
                  <span
                    className={`rounded-full px-1.5 py-px font-ui text-micro tabular-nums ${
                      on ? 'bg-gold-dim text-gold' : 'bg-ink-raised text-grey-faint'
                    }`}
                  >
                    {n}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ---- Search and filters -------------------------------------- */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <StoriesToolbar
            q={q}
            hidden={carried}
            filters={[
              {
                name: 'shelf',
                label: 'Shelf',
                value: shelf,
                options: [
                  { value: '', label: 'All shelves' },
                  ...shelves.map((s) => ({ value: s.slug, label: s.label })),
                ],
              },
              {
                name: 'author',
                label: 'Author',
                value: author,
                options: [
                  { value: '', label: 'All authors' },
                  ...authors.map((a) => ({ value: a.slug, label: a.name })),
                ],
              },
              { name: 'read', label: 'Read time', value: read, options: READ_TIMES },
            ]}
          />
        </div>
        <ViewToggle view={view} href={(next) => link({ view: next })} />
      </div>

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-ui text-sm text-grey-muted">
          {total === 0
            ? 'Nothing found'
            : `${total} ${total === 1 ? 'story' : 'stories'} found`}
          {q && <span className="text-grey-faint"> for “{q}”</span>}
        </p>
        {filtered && (
          <Link
            href={link({ q: '', shelf: '', author: '', read: '', page: '1' }) as Route}
            className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* ---- The list ------------------------------------------------ */}
      {stories.length === 0 ? (
        <EmptyState
          title="No stories yet."
          body="Write one here, or download the template from the Writing Room and bring it back when it is done."
          action={{ href: '/studio', label: 'The Writing Room' }}
        />
      ) : total === 0 ? (
        <div className="rounded-lg border border-rule bg-ink-raised px-8 py-14 text-center">
          <p className="font-display text-xl text-ivory">Nothing matches that.</p>
          <p className="mx-auto mt-2.5 max-w-md text-sm leading-normal text-grey-muted">
            There {stories.length === 1 ? 'is' : 'are'} {stories.length} stor
            {stories.length === 1 ? 'y' : 'ies'} in the House — none of them in
            this corner of it.
          </p>
          <Link
            href={'/admin/stories' as Route}
            className="mt-5 inline-block rounded-lg border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            Show everything
          </Link>
        </div>
      ) : view === 'grid' ? (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((s) => (
            <li key={s.slug}>
              <AdminStoryTile story={s} items={menuFor(s)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Title</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Byline</th>
                <th className="sf-eyebrow px-5 py-3 text-left">With</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Release</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Opens</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Updated</th>
                <th className="sf-eyebrow px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-rule">
              {shown.map((s) => (
                <tr key={s.slug} className="transition-colors hover:bg-ink-raised">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/admin/stories/${s.slug}` as Route}
                      className="block text-ivory transition-colors hover:text-gold"
                    >
                      {s.title}
                    </Link>
                    <ThemeChips themes={s.themes} className="mt-1" />
                  </td>

                  <td className="px-5 py-3.5 text-grey-muted">{s.authorName ?? '—'}</td>

                  <td className="px-5 py-3.5">
                    {s.assignedName ? (
                      <span
                        className={
                          s.assignedAuthorSlug !== s.authorSlug
                            ? 'text-gold'
                            : 'text-grey-muted'
                        }
                      >
                        {s.assignedName}
                      </span>
                    ) : (
                      <span className="text-xs text-grey-muted">The House</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={s.status} />
                      {s.revisionNote && s.status === 'draft' && (
                        <span
                          className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold"
                          title={s.revisionNote}
                        >
                          Sent back
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-grey-muted">
                    {s.releaseMode === 'serial' ? (
                      <span>
                        {s.chapters.filter((c) => c.status === 'published').length}/
                        {s.chapters.length} chapters
                      </span>
                    ) : (
                      <span className="text-xs">Whole</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatCount(s.views)}
                  </td>

                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatDate(s.updatedAt ?? s.publishedAt ?? s.submittedAt)}
                  </td>

                  <td className="px-5 py-3.5">
                    <KebabMenu label={s.title} items={menuFor(s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- Pages --------------------------------------------------- */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-4 py-8 sm:justify-between">
          <PerPage value={per} hidden={{ ...carried, ...(q ? { q } : {}) }} />
          <Pagination page={current} pages={pages} href={(n) => link({ page: String(n) })} />
          <p className="font-ui text-xs text-grey-muted">
            Showing {start + 1} – {Math.min(start + per, total)} of {total}
          </p>
        </div>
      )}

      {/* Handing work on. */}
      {stories.length > 0 && writers.length > 1 && (
        <section className="mt-6 border-t border-rule pt-8">
          <h2 className="sf-eyebrow mb-4">Hand a story to someone else</h2>
          <ReassignForm
            stories={stories
              .filter((s) => s.status !== 'published')
              .map((s) => ({ slug: s.slug, title: s.title }))}
            authors={writers}
          />
        </section>
      )}
    </>
  );
}

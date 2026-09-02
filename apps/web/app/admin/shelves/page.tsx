import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminShelves } from '@/lib/admin-data';
import { PageHeader, StatusPill, EmptyState } from '@/components/admin/ui';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { deleteShelf } from '@/app/actions/editorial';

export const metadata: Metadata = { title: 'Shelves' };
export const dynamic = 'force-dynamic';

/*
 * The Library of Feelings.
 *
 * The column worth scanning is Journey: a shelf with no onward edges is a
 * dead end, and a reader who reaches it has nowhere the House suggests
 * going next. Empty shelves are called out for the same reason — a shelf
 * in the navigation with nothing on it is a promise the House breaks.
 */
export default async function ShelvesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [{ saved, deleted }, shelves] = await Promise.all([
    searchParams,
    listAdminShelves(),
  ]);

  const byLabel = new Map(shelves.map((s) => [s.slug, s.label]));

  return (
    <>
      <PageHeader
        title="Shelves"
        subtitle="Emotional entry points, not categories. Each one is a place in the House with its own voice."
        action={{ href: '/admin/shelves/new', label: 'New shelf' }}
      />

      {saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Saved “{saved}”.
        </p>
      )}
      {deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          Shelf deleted.
        </p>
      )}

      {shelves.length === 0 ? (
        <EmptyState
          title="No shelves yet."
          body="A shelf is how a reader finds their way in — they arrive feeling something, not looking for a genre."
          action={{ href: '/admin/shelves/new', label: 'Make the first' }}
        />
      ) : (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Shelf</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Stories</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Journey</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Order</th>
                <th className="sf-eyebrow px-5 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {shelves.map((s) => {
                const deadEnd = s.continuesTo.length === 0;
                return (
                  <tr key={s.slug} className="transition-colors hover:bg-ink-raised">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/shelves/${s.slug}`} className="flex items-start gap-3">
                        <span aria-hidden="true" className="text-lg leading-none">
                          {s.emoji}
                        </span>
                        {/*
                          The URL is not shown. It is a technical detail of
                          where the page lives, not a fact about the shelf,
                          and a column of /shelf/… in a monospace font reads
                          like something the reader is meant to act on.
                        */}
                        <span className="min-w-0">
                          <span className="block text-ivory">{s.label}</span>
                        </span>
                      </Link>
                    </td>

                    <td className="px-5 py-3.5">
                      <StatusPill status={s.status} />
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {s.storyCount === 0 ? (
                        <span
                          className="whitespace-nowrap border border-state-danger/50 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-state-danger"
                          title="In the navigation with nothing on it"
                        >
                          Empty
                        </span>
                      ) : (
                        <span className="tabular-nums text-grey-muted">
                          {s.storyCount}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {deadEnd ? (
                        <span className="font-ui text-xs text-grey-muted">
                          Nowhere onward
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-grey-muted">
                          <span aria-hidden="true">→</span>
                          {s.continuesTo.map((slug) => (
                            <span
                              key={slug}
                              className="border border-rule px-1.5 py-0.5 text-grey"
                            >
                              {byLabel.get(slug) ?? slug}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                      {s.sortOrder}
                    </td>

                    <td className="px-5 py-3.5">
                      <KebabMenu
                        label={s.label}
                        items={[
                          { kind: 'link', label: 'Edit shelf', href: `/admin/shelves/${s.slug}` as never },
                          { kind: 'link', label: 'View on site', href: `/shelf/${s.slug}` as never },
                          {
                            kind: 'action',
                            label: 'Delete shelf',
                            action: deleteShelf,
                            fields: { slug: s.slug },
                            danger: true,
                            confirm:
                              s.storyCount > 0
                                ? `Delete “${s.label}”? ${s.storyCount} stories sit here and would lose their shelf.`
                                : `Delete “${s.label}”?`,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

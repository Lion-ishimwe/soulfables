import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { listAdminSeries } from '@/lib/series';
import { PageHeader, StatusPill } from '@/components/admin/ui';
import { SeriesForm } from '@/components/admin/series-form';
import { deleteSeries } from '@/app/actions/editorial';

export const metadata: Metadata = { title: 'Series' };
export const dynamic = 'force-dynamic';

/**
 * Series: stories told in more than one sitting.
 *
 * A series is made here; its episodes are assigned on each story's own
 * page, where the story is given a series and an episode number. A
 * series marked Premium keeps every episode for Premium, whatever each
 * story says for itself.
 */
export default async function SeriesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; edit?: string; deleted?: string; kept?: string }>;
}) {
  await requireStaff();
  const [{ saved, edit, deleted, kept }, series] = await Promise.all([searchParams, listAdminSeries()]);
  const editing = edit ? (series.find((s) => s.slug === edit) ?? null) : null;
  const th = 'px-5 py-3.5 text-left font-normal font-ui text-micro uppercase tracking-[0.14em] text-grey-faint';

  return (
    <>
      <PageHeader title="Series" subtitle="Stories that belong together, read in order. Some kept for Premium." />

      {saved && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          “{saved}” is saved. Give it episodes from each story’s page.
        </p>
      )}
      {deleted && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          “{deleted}” is gone.
        </p>
      )}
      {kept && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          That series still has episodes. Move them out of it first.
        </p>
      )}

      <div className="space-y-8">
        <SeriesForm key={editing?.slug ?? 'new'} series={editing} readOnly={isDemoMode()} />

        <div className="overflow-x-auto rounded-lg border border-rule bg-ink-raised">
          <table className="w-full min-w-[40rem]">
            <thead>
              <tr className="border-b border-rule">
                <th className={th}>Series</th>
                <th className={`${th} w-28`}>Access</th>
                <th className={`${th} w-24 text-right`}>Episodes</th>
                <th className={`${th} w-28`}>Status</th>
                <th className={`${th} w-40`}>
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {series.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center font-ui text-sm text-grey-muted">
                    No series yet. Create the first one above.
                  </td>
                </tr>
              )}
              {series.map((s) => (
                <tr key={s.slug} className={`border-b border-rule transition-colors last:border-0 hover:bg-ink-hover ${editing?.slug === s.slug ? 'bg-ink-hover' : ''}`}>
                  <td className="px-5 py-4">
                    <span className="block font-display text-base text-ivory">{s.title}</span>
                    <Link href={`/series/${s.slug}` as Route} className="mt-0.5 block font-ui text-xs text-grey-muted hover:text-gold">
                      /series/{s.slug}
                    </Link>
                  </td>
                  <td className="px-5 py-4 font-ui text-sm text-grey">{s.access === 'premium' ? 'Premium' : 'Free'}</td>
                  <td className="px-5 py-4 text-right font-ui text-sm tabular-nums text-grey-muted">{s.episodes}</td>
                  <td className="px-5 py-4">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/series?edit=${s.slug}` as Route}
                        className="whitespace-nowrap border border-gold/50 px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
                      >
                        Edit
                      </Link>
                      {s.episodes === 0 && (
                        <form action={deleteSeries}>
                          <input type="hidden" name="slug" value={s.slug} />
                          <button
                            type="submit"
                            disabled={isDemoMode()}
                            className="whitespace-nowrap border border-rule px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-grey-muted transition-all hover:border-state-danger/60 hover:text-ivory disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

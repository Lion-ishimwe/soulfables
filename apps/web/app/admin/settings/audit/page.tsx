import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listAuditEntries, AUDIT_PAGE_SIZE, type AuditFilters } from '@/lib/audit';
import { AdminPageHeader, Panel, PanelEmpty, relativeTime } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

/**
 * The audit log.
 *
 * Append-only by policy as well as by convention: no update or delete
 * policy exists for any role, including owner.
 *
 * Every insert, update and delete on 51 tables is recorded by a database
 * trigger (migration 0021) rather than by the application remembering to
 * — which means a change made through the Supabase dashboard or by a
 * script holding the service key lands here too. Before that, five
 * server actions wrote entries and everything else changed silently.
 *
 * Thirty most recent by default, no filter applied. A window is a form
 * that navigates, so it can be linked to and survives a refresh. Date and
 * time are separate controls because they answer different questions —
 * "what happened last week" and "what happened overnight" — and resolve
 * to one range.
 *
 * There were dropdowns for table and actor. They went: on a log where
 * almost everything is one person and a handful of tables, they were two
 * controls earning nothing, and the columns already show both.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditFilters & { page?: string }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const page = Math.max(0, Number(params.page ?? 0) || 0);

  const { entries, total, live } = await listAuditEntries(params, page);

  const field =
    'w-full rounded border border-rule bg-ink px-3 py-2 font-ui text-xs text-ivory outline-none transition-colors focus:border-gold/50';
  const label = 'mb-1.5 block font-ui text-micro uppercase tracking-[0.14em] text-grey-muted';

  const pages = Math.ceil(total / AUDIT_PAGE_SIZE);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') q.set(k, String(v));
    if (n > 0) q.set('page', String(n));
    return (q.toString() ? `/admin/settings/audit?${q}` : '/admin/settings/audit') as Route;
  };

  const hasFilter = Boolean(
    params.from || params.to || params.fromTime || params.toTime,
  );

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <p className="mb-6 max-w-prose font-ui text-sm text-grey-muted">
        Who changed what. Nobody can edit or remove an entry — not even an owner.
      </p>

      {/* ---- Filters ------------------------------------------------ */}
      <form
        method="GET"
        action="/admin/settings/audit"
        className="mb-6 rounded-lg border border-rule bg-ink-raised p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="f-from" className={label}>From date</label>
            <input id="f-from" name="from" type="date" defaultValue={params.from ?? ''} className={field} />
          </div>
          <div>
            <label htmlFor="f-fromtime" className={label}>From time</label>
            <input id="f-fromtime" name="fromTime" type="time" defaultValue={params.fromTime ?? ''} className={field} />
          </div>
          <div>
            <label htmlFor="f-to" className={label}>To date</label>
            <input id="f-to" name="to" type="date" defaultValue={params.to ?? ''} className={field} />
          </div>
          <div>
            <label htmlFor="f-totime" className={label}>To time</label>
            <input id="f-totime" name="toTime" type="time" defaultValue={params.toTime ?? ''} className={field} />
          </div>

        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded bg-gold px-5 py-2 font-ui text-xs text-ink transition-opacity hover:opacity-90"
          >
            Apply
          </button>
          {hasFilter && (
            <Link
              href={'/admin/settings/audit' as Route}
              className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
            >
              Clear
            </Link>
          )}
          <span className="ml-auto font-ui text-xs text-grey-faint">
            {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
            {hasFilter ? ' matching' : ''}
          </span>
        </div>
      </form>

      {/* ---- Entries ------------------------------------------------ */}
      <Panel title="Changes" hint="Newest first. Times are this browser's.">
        {!live ? (
          <PanelEmpty>
            Demo mode records nothing. Connect a database and every change is
            written here as it happens.
          </PanelEmpty>
        ) : entries.length === 0 ? (
          <PanelEmpty>
            {hasFilter
              ? 'Nothing changed in that window. Widen the dates, or clear the filters.'
              : 'Nothing recorded yet. The next change anybody makes appears here.'}
          </PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem]">
              <thead>
                <tr className="border-b border-rule text-left font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                  <th className="px-5 py-3 font-normal">Action</th>
                  <th className="px-5 py-3 font-normal">Table</th>
                  <th className="px-5 py-3 font-normal">Fields changed</th>
                  <th className="px-5 py-3 font-normal">Who</th>
                  <th className="w-40 px-5 py-3 font-normal">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-rule/60 transition-colors last:border-0 hover:bg-ink-hover"
                  >
                    <td className="px-5 py-3">
                      <span className="font-ui text-sm text-ivory">
                        {e.action.replace(/[._]/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-grey-muted">
                      {e.entityType ?? '—'}
                    </td>
                    <td className="max-w-sm px-5 py-3">
                      {e.changed.length === 0 ? (
                        <span className="font-ui text-xs text-grey-faint">—</span>
                      ) : (
                        <span className="font-mono text-xs leading-relaxed text-grey-muted">
                          {e.changed.slice(0, 6).join(', ')}
                          {e.changed.length > 6 ? ` +${e.changed.length - 6}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-ui text-xs text-grey">
                      {/*
                        No actor means the change did not come from a
                        signed-in session — a migration, a seed, or a
                        script with the service key. Saying "system" is
                        honest; attributing it to somebody would not be.
                      */}
                      {e.actor ?? <span className="text-grey-faint">system</span>}
                    </td>
                    <td className="px-5 py-3">
                      <span className="block font-ui text-xs text-ivory">
                        {relativeTime(e.at)}
                      </span>
                      <span className="block font-mono text-micro text-grey-faint">
                        {new Date(e.at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-rule px-5 py-4">
            {page > 0 ? (
              <Link href={pageHref(page - 1)} className="font-ui text-xs text-gold hover:text-gold-soft">
                ← Newer
              </Link>
            ) : <span />}
            <span className="font-ui text-xs text-grey-faint">
              Page {page + 1} of {pages}
            </span>
            {page + 1 < pages ? (
              <Link href={pageHref(page + 1)} className="font-ui text-xs text-gold hover:text-gold-soft">
                Older →
              </Link>
            ) : <span />}
          </div>
        )}
      </Panel>

      {/*
        Stated rather than left to be discovered. An audit trail with
        silent gaps is worse than one that names them.
      */}
      <p className="mt-4 font-ui text-micro leading-relaxed text-grey-faint">
        Every insert, update and delete is recorded by the database itself, so a
        change made outside this admin is recorded too. Reading progress and
        page-view telemetry are deliberately excluded — they change on every
        scroll and would bury everything else. Story bodies are recorded as a
        length, not as text.
      </p>
    </>
  );
}

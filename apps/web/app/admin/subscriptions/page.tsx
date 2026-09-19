import type { Metadata } from 'next';
import { isReadOnly, listAdminSubscribers } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, EmptyState, StatusPill } from '@/components/admin/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Residency' };
export const dynamic = 'force-dynamic';

/*
 * Who is a Resident.
 *
 * This rendered DEMO_READERS — four invented subscribers, one of them
 * carrying the founder's own name — with no branch on whether a database
 * was connected. It read as a membership list and was a fixture.
 *
 * It reads subscriptions now. Nobody can subscribe until a payment
 * provider is connected, so it is empty and says why.
 */
export default async function SubscriptionsPage() {
  const people = await listAdminSubscribers();
  const active = people.filter((p) => p.status === 'active' || p.status === 'trialing');

  return (
    <>
      <PageHeader
        title="Residency"
        subtitle="Who is subscribed, and until when."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      {people.length === 0 ? (
        <EmptyState
          title="No Premium readers yet."
          body="Residency needs a payment provider before anybody can subscribe. Readers with accounts are listed under Settings → Report; this page is only about who is paying."
          action={{ href: '/admin/settings/report', label: 'See the readers' }}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-rule bg-ink-raised p-5">
              <p className="font-ui text-xs text-grey-muted">Premium readers</p>
              <p className="mt-2 font-display text-3xl leading-none text-ivory">
                {active.length}
              </p>
            </div>
            <div className="rounded-lg border border-rule bg-ink-raised p-5">
              <p className="font-ui text-xs text-grey-muted">Leaving</p>
              <p className="mt-2 font-display text-3xl leading-none text-ivory">
                {people.filter((p) => p.cancelling).length}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-rule">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="sf-eyebrow px-5 py-3 text-left">Name</th>
                  <th className="sf-eyebrow px-5 py-3 text-left">Email</th>
                  <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                  <th className="sf-eyebrow px-5 py-3 text-right">Renews</th>
                  <th className="sf-eyebrow px-5 py-3 text-right">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-raised">
                    <td className="px-5 py-3.5 text-ivory">{p.name ?? '—'}</td>
                    <td className="px-5 py-3.5 text-xs text-grey-muted">
                      {p.email ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusPill status={p.status} />
                        {p.cancelling && (
                          <span className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                            Leaving
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                      {formatDate(p.periodEnd)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                      {formatDate(p.since)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

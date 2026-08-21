import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, Stat } from '@/components/admin/ui';
import { DEMO_READERS } from '@/lib/demo/admin';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Residency' };
export const dynamic = 'force-dynamic';

/*
 * Residency.
 *
 * Tiers are rows, not code (brief 16), so adding one is an editorial
 * decision rather than a deploy. A subscription grants real entitlement
 * rows with an expiry, which means the download path is identical to a
 * purchase — one code path to get right instead of two.
 */
export default function SubscriptionsPage() {
  const residents = DEMO_READERS.filter((r) => r.plan === 'resident');
  const monthly = residents.length * 600;

  return (
    <>
      <PageHeader
        title="Residency"
        subtitle="Members, and what their tier grants them."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-8 grid gap-px bg-rule sm:grid-cols-3">
        <Stat label="Residents" value={residents.length} hint="Active members" />
        <Stat label="Monthly" value={formatMoney(monthly, 'USD')} hint="Recurring, before fees" />
        <Stat label="Tiers" value={2} hint="Reader and Resident" />
      </div>

      <div className="mb-10 overflow-x-auto border border-rule">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Member</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Email</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {residents.map((r) => (
              <tr key={r.email} className="hover:bg-ink-raised">
                <td className="px-5 py-3.5 text-ivory">{r.displayName}</td>
                <td className="px-5 py-3.5 text-grey-muted">{r.email}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {formatDate(r.joinedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="border border-rule p-6">
        <h2 className="sf-eyebrow mb-4">What each tier grants</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-display text-xl text-ivory">Reader</p>
            <p className="mt-2 text-sm leading-normal text-grey-muted">
              Free stories, the journal, saved stories, bookmarks and the
              Weekly Letter.
            </p>
          </div>
          <div>
            <p className="font-display text-xl text-ivory">Resident</p>
            <p className="mt-2 text-sm leading-normal text-grey-muted">
              Everything a Reader has, plus premium shelves, narrated
              editions, offline listening and the companion.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

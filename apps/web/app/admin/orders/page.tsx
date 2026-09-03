import type { Metadata } from 'next';
import { isReadOnly, listAdminOrders } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, EmptyState, StatusPill } from '@/components/admin/ui';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

/*
 * What the House has sold.
 *
 * This rendered DEMO_ORDERS — seven invented orders, with invented
 * customer emails, invented totals and "files released" ticks — with no
 * branch on whether a database was connected. Anyone reading this page
 * would have concluded the House had taken money it has never taken.
 *
 * It reads the orders table now. There are none, because payments are the
 * last milestone and nothing can place one yet; the page says that
 * plainly rather than inventing a ledger.
 */
export default async function OrdersPage() {
  const orders = await listAdminOrders();

  const paid = orders.filter((o) => o.status === 'paid');
  const taken = paid.reduce((sum, o) => sum + o.total, 0);
  const currency = orders[0]?.currency ?? 'USD';

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Every purchase, and whether the files went out."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      {orders.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-rule bg-ink-raised p-5">
            <p className="font-ui text-xs text-grey-muted">Orders</p>
            <p className="mt-2 font-display text-3xl leading-none text-ivory">
              {orders.length}
            </p>
          </div>
          <div className="rounded-lg border border-rule bg-ink-raised p-5">
            <p className="font-ui text-xs text-grey-muted">Paid</p>
            <p className="mt-2 font-display text-3xl leading-none text-ivory">
              {paid.length}
            </p>
          </div>
          <div className="rounded-lg border border-rule bg-ink-raised p-5">
            <p className="font-ui text-xs text-grey-muted">Taken</p>
            <p className="mt-2 font-display text-3xl leading-none text-ivory">
              {formatMoney(taken, currency)}
            </p>
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet."
          body="Nothing can be bought until a payment provider is connected, so this stays empty until then. When it fills, each row is a real purchase with a real reference."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Reference</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Buyer</th>
                <th className="sf-eyebrow px-5 py-3 text-left">What</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Total</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-ink-raised">
                  <td className="px-5 py-3.5 font-mono text-xs text-ivory">
                    {o.reference}
                  </td>
                  <td className="px-5 py-3.5 text-grey-muted">{o.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-grey-muted">
                    {o.items.length ? o.items.join(', ') : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-ivory">
                    {formatMoney(o.total, o.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatDate(o.paidAt ?? o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, StatusPill, Stat } from '@/components/admin/ui';
import { DEMO_ORDERS } from '@/lib/demo/admin';
import { formatMoney, formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

/*
 * Orders.
 *
 * The column that earns its place is "Delivered". An order is not
 * finished when money arrives — it is finished when the customer has
 * their files. Showing payment status alone is how a shop convinces
 * itself everything is fine while books sit undelivered.
 */
export default function OrdersPage() {
  const paid = DEMO_ORDERS.filter((o) => o.status === 'paid');
  const revenue = paid.reduce((sum, o) => sum + o.amount, 0);
  const needsAttention = DEMO_ORDERS.filter(
    (o) => o.status === 'pending' || o.status === 'failed',
  );

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Every purchase, and whether the customer actually received it."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-8 grid gap-px bg-rule sm:grid-cols-3">
        <Stat label="Paid" value={paid.length} hint="Last 7 days" />
        <Stat label="Revenue" value={formatMoney(revenue, 'USD')} hint="Before fees" />
        <Stat
          label="Need attention"
          value={needsAttention.length}
          hint="Pending or failed"
        />
      </div>

      {needsAttention.length > 0 && (
        <div className="mb-8 border-l-2 border-gold bg-gold-dim px-6 py-4">
          <p className="font-ui text-sm font-semibold text-ivory">
            {needsAttention.length} order
            {needsAttention.length === 1 ? '' : 's'} did not complete
          </p>
          <p className="mt-1.5 max-w-2xl text-sm leading-normal text-grey">
            A pending order usually means the webhook has not arrived yet. If
            one stays pending for more than a few minutes, check the provider
            dashboard before contacting the customer — the money may have moved
            without us hearing about it.
          </p>
        </div>
      )}

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Reference</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Customer</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Product</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Delivered</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Amount</th>
              <th className="sf-eyebrow px-5 py-3 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {DEMO_ORDERS.map((o) => {
              const delivered = o.status === 'paid';
              return (
                <tr key={o.reference} className="hover:bg-ink-raised">
                  <td className="px-5 py-3.5 font-mono text-xs text-ivory">
                    {o.reference}
                  </td>
                  <td className="px-5 py-3.5 text-grey-muted">{o.email}</td>
                  <td className="px-5 py-3.5 text-grey">{o.title}</td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    {delivered ? (
                      <span className="font-ui text-xs text-state-success">
                        ✓ Files released
                      </span>
                    ) : (
                      <span className="font-ui text-xs text-grey-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-ivory">
                    {formatMoney(o.amount, o.currency)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

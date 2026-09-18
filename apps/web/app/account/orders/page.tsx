import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { getMyOrders } from '@/lib/orders';
import { getHouseSettings } from '@/lib/settings';
import { formatDate, formatMoney } from '@/lib/format';

export const metadata: Metadata = { title: 'Orders', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'text-state-success' },
  pending: { label: 'Awaiting payment', tone: 'text-gold' },
  failed: { label: 'Did not go through', tone: 'text-grey-muted' },
  refunded: { label: 'Refunded', tone: 'text-grey-muted' },
};

/**
 * Orders.
 *
 * Every purchase, its receipt, and where its files are. The files live
 * in the library, so this page points there rather than repeating them;
 * what belongs here is the paper: what was bought, when, for how much,
 * and a receipt that can be printed for an expense claim or a dispute.
 */
export default async function OrdersPage() {
  await requireViewer('/account/orders');
  const [orders, house] = await Promise.all([getMyOrders(), getHouseSettings()]);

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="mb-10">
        <p className="sf-eyebrow">Your shelf</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory">Orders</h1>
        <p className="mt-3 font-ui text-sm text-grey-muted">
          Every purchase and its receipt. The books themselves are in{' '}
          <Link href={'/account/library' as Route} className="text-gold transition-colors hover:text-gold-soft">
            your library
          </Link>
          .
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-rule px-8 py-14 text-center">
          <p className="font-display text-2xl text-ivory">Nothing bought yet.</p>
          <p className="mx-auto mt-3 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            When you buy something from the Bookshop it will be listed here with its
            receipt. Bought as a guest before making this account, with the same email?
            It arrives here the next time you sign in.
          </p>
          <Link
            href={'/shop' as Route}
            className="mt-8 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            The Bookshop
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-rule border border-rule">
          {orders.map((o) => {
            const s = STATUS[o.status] ?? { label: o.status, tone: 'text-grey-muted' };
            return (
              <li key={o.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-grey-muted">
                    {o.reference} · {formatDate(o.paidAt ?? o.createdAt)}
                  </p>
                  <p className="mt-1.5 font-display text-xl text-ivory">
                    {o.lines.map((l) => l.title).join(', ') || 'Order'}
                  </p>
                  <p className={`mt-1 font-ui text-xs ${s.tone}`}>{s.label}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <p className="font-display text-xl text-ivory">{formatMoney(o.total, o.currency)}</p>
                  {o.status === 'paid' || o.status === 'refunded' ? (
                    <Link
                      href={`/account/orders/${o.reference}` as Route}
                      className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
                    >
                      Receipt →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 font-ui text-xs leading-relaxed text-grey-muted">
        Something missing, or a receipt that is wrong? Write to{' '}
        <a href={`mailto:${house.supportEmailShop}`} className="text-gold transition-colors hover:text-gold-soft">
          {house.supportEmailShop}
        </a>{' '}
        with the order reference. When money comes back, and when it does not, is set out in the{' '}
        <Link href={'/digital-products' as Route} className="text-gold transition-colors hover:text-gold-soft">
          digital products policy
        </Link>
        .
      </p>
    </div>
  );
}

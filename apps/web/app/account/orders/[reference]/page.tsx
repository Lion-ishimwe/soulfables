import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { getMyOrder } from '@/lib/orders';
import { getHouseSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/format';
import { PrintButton } from '@/components/print-button';

export const metadata: Metadata = { title: 'Receipt', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * A receipt.
 *
 * Plain on purpose: who took the money, who paid, what for, how much,
 * when, and the payment reference the provider knows it by. It prints
 * onto one page without the site's chrome, because that is what a
 * receipt is for. The business name, address and tax number come from
 * Settings → The House; until they are set, the House signs it.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const viewer = await requireViewer(`/account/orders/${reference}`);
  const [order, house] = await Promise.all([getMyOrder(reference), getHouseSettings()]);
  if (!order || (order.status !== 'paid' && order.status !== 'refunded')) notFound();

  const seller = house.legalName ?? house.siteName;
  const provider = order.provider === 'paypal' ? 'PayPal' : order.provider === 'stripe' ? 'Stripe' : order.provider;

  return (
    <div className="mx-auto max-w-content px-5 py-16 sm:px-8 print:max-w-none print:px-0 print:py-0">
      <nav className="mb-8 flex items-center justify-between print:hidden">
        <Link href={'/account/orders' as Route} className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory">
          ← Orders
        </Link>
        <PrintButton />
      </nav>

      <article className="border border-rule bg-ink-raised p-8 print:border-0 print:bg-transparent print:p-0 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-rule pb-8">
          <div>
            <p className="font-display text-2xl text-ivory">{seller}</p>
            {house.legalAddress && (
              <p className="mt-1 whitespace-pre-line font-ui text-xs leading-relaxed text-grey-muted">{house.legalAddress}</p>
            )}
            {house.vatNumber && <p className="mt-1 font-ui text-xs text-grey-muted">VAT {house.vatNumber}</p>}
            <p className="mt-1 font-ui text-xs text-grey-muted">{house.supportEmailShop}</p>
          </div>
          <div className="text-right">
            <p className="sf-eyebrow">{order.status === 'refunded' ? 'Refund receipt' : 'Receipt'}</p>
            <p className="mt-2 font-mono text-sm text-ivory">{order.reference}</p>
            <p className="mt-1 font-ui text-xs text-grey-muted">{longDate(order.paidAt ?? order.createdAt)}</p>
          </div>
        </header>

        <dl className="grid gap-x-8 gap-y-3 py-6 sm:grid-cols-2">
          <div>
            <dt className="sf-eyebrow">Billed to</dt>
            <dd className="mt-1 font-ui text-sm text-ivory">{viewer.displayName ?? order.email}</dd>
            <dd className="font-ui text-xs text-grey-muted">{order.email}</dd>
          </div>
          <div>
            <dt className="sf-eyebrow">Paid by</dt>
            <dd className="mt-1 font-ui text-sm text-ivory">{provider}</dd>
            {order.providerPaymentId && (
              <dd className="font-mono text-xs text-grey-muted">{order.providerPaymentId}</dd>
            )}
          </div>
        </dl>

        <table className="w-full border-t border-rule">
          <thead>
            <tr className="border-b border-rule text-left">
              <th className="py-3 font-normal sf-eyebrow">Item</th>
              <th className="py-3 text-right font-normal sf-eyebrow">Qty</th>
              <th className="py-3 text-right font-normal sf-eyebrow">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l, i) => (
              <tr key={i} className="border-b border-rule">
                <td className="py-3 font-ui text-sm text-ivory">
                  {l.title}
                  <span className="block font-ui text-xs text-grey-muted">Digital download</span>
                </td>
                <td className="py-3 text-right font-ui text-sm tabular-nums text-grey">{l.quantity}</td>
                <td className="py-3 text-right font-ui text-sm tabular-nums text-ivory">
                  {formatMoney(l.unitAmount * l.quantity, l.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {order.discount > 0 && (
              <tr>
                <td colSpan={2} className="pt-3 text-right font-ui text-xs text-grey-muted">Discount</td>
                <td className="pt-3 text-right font-ui text-sm tabular-nums text-grey">−{formatMoney(order.discount, order.currency)}</td>
              </tr>
            )}
            {order.tax > 0 && (
              <tr>
                <td colSpan={2} className="pt-2 text-right font-ui text-xs text-grey-muted">Tax</td>
                <td className="pt-2 text-right font-ui text-sm tabular-nums text-grey">{formatMoney(order.tax, order.currency)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={2} className="pt-4 text-right font-ui text-sm text-ivory">
                {order.status === 'refunded' ? 'Refunded' : 'Total paid'}
              </td>
              <td className="pt-4 text-right font-display text-2xl tabular-nums text-ivory">
                {formatMoney(order.total, order.currency)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-8 font-ui text-xs leading-relaxed text-grey-muted">
          Digital goods, delivered to the buyer&rsquo;s library at {house.siteUrl ?? 'the House'} on payment.
          {order.tax === 0 && ' No tax has been added to this amount.'}
          {order.refundedAt && ` Refunded ${longDate(order.refundedAt)}.`}
        </p>
      </article>
    </div>
  );
}

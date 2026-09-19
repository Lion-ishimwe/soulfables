import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { listRefundRequests, REASON_LABELS, type DeskRequest } from '@/lib/refunds';
import { formatDate, formatMoney } from '@/lib/format';
import { PageHeader, EmptyState } from '@/components/admin/ui';
import { RefundDecision } from '@/components/admin/refund-decision';

export const metadata: Metadata = { title: 'Refunds' };
export const dynamic = 'force-dynamic';

/**
 * The refund desk.
 *
 * Every request a reader has made from a receipt, with what the policy
 * needs to decide it laid beside it: how long since the order was
 * paid, whether a file was ever downloaded, and which windows are still
 * open. Two buttons. The money goes back through PayPal from here; the
 * order, the library and the reader's email follow.
 */
export default async function RefundsPage() {
  await requireStaff();
  const { open, decided } = await listRefundRequests();

  return (
    <>
      <PageHeader title="Refunds" subtitle="What readers have asked to have back, and what the policy says about each." />

      {isDemoMode() && (
        <p className="mb-6 rounded border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          The demo takes no money, so there is nothing here to return.
        </p>
      )}

      <section className="mb-12">
        <h2 className="font-display text-2xl text-ivory">
          Waiting {open.length > 0 && <span className="text-gold">· {open.length}</span>}
        </h2>
        {open.length === 0 ? (
          <p className="mt-3 font-ui text-sm text-grey-muted">Nothing waiting. A request made from a receipt appears here.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {open.map((r) => (
              <li key={r.id} className="rounded-lg border border-rule bg-ink-raised p-5">
                <Request r={r} />
                <div className="mt-5 border-t border-rule pt-5">
                  <RefundDecision requestId={r.id} amountLabel={formatMoney(r.order.total, r.order.currency)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-ivory">Decided</h2>
        {decided.length === 0 ? (
          <EmptyState title="No decisions yet." body="Refunds granted and declined are kept here, with the note the reader was given." />
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-lg border border-rule">
            {decided.map((r) => (
              <li key={r.id} className="p-5">
                <Request r={r} />
                <p className="mt-3 font-ui text-xs text-grey-muted">
                  <span className={r.status === 'refunded' ? 'text-state-success' : 'text-ivory'}>
                    {r.status === 'refunded' ? 'Refunded' : 'Declined'}
                  </span>{' '}
                  {formatDate(r.decidedAt)}
                  {r.decisionNote && <> · &ldquo;{r.decisionNote}&rdquo;</>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Request({ r }: { r: DeskRequest }) {
  const w = r.window;
  const verdict =
    r.reason === 'changed_mind'
      ? w.changeOfMindOpen
        ? 'Within fourteen days and nothing downloaded: the policy says refund.'
        : w.downloads > 0
          ? 'A file was downloaded: a change of mind is no longer grounds.'
          : 'Past fourteen days: a change of mind is no longer grounds.'
      : r.reason === 'faulty'
        ? w.faultyOpen
          ? 'Within thirty days: put it right, or refund.'
          : 'Past thirty days: outside the window, but read it.'
        : r.reason === 'duplicate'
          ? 'Bought twice: refund whenever noticed. Check the orders list for the other purchase.'
          : 'No window applies: a person decides.';

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="font-mono text-xs text-grey-muted">
          {r.order.reference} · asked {formatDate(r.createdAt)} · paid {w.daysSincePaid} day{w.daysSincePaid === 1 ? '' : 's'} ago
        </p>
        <p className="mt-1.5 font-display text-xl text-ivory">{r.order.items.join(', ') || 'Order'}</p>
        <p className="mt-1 font-ui text-sm text-grey">
          {r.order.email} · {formatMoney(r.order.total, r.order.currency)}
        </p>
        <p className="mt-3 font-ui text-sm text-ivory">
          <span className="text-gold">{REASON_LABELS[r.reason]}.</span>
          {r.message && <> &ldquo;{r.message}&rdquo;</>}
        </p>
        <p className="mt-2 font-ui text-xs text-grey-muted">
          Downloads: {w.downloads}
          {w.lastDownloadAt && `, last ${formatDate(w.lastDownloadAt)}`}. {verdict}
        </p>
      </div>
      <Link href={'/admin/orders' as Route} className="shrink-0 font-ui text-xs text-grey-muted transition-colors hover:text-ivory">
        Orders →
      </Link>
    </div>
  );
}

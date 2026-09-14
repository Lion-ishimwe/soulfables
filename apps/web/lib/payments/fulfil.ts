import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendDeliveryEmail } from '@/lib/email';
import { formatMoney } from '@/lib/format';

/**
 * Turning a verified payment into a paid order and a granted book.
 *
 * This used to live inside the webhook handler, which was the only
 * caller. PayPal adds a second: the buyer's own return from PayPal, where
 * the server captures the payment itself and holds PayPal's answer in
 * its hand. Both paths hold proof of money — one signed by the provider,
 * one fetched from it over TLS with our credentials — and neither trusts
 * anything the browser said. So they share this, and nothing else grants.
 *
 * Idempotent by construction: the order flips from pending to paid with
 * a conditional update, so two callers arriving at once cannot both
 * grant, and a second call for a paid order says so and stops.
 */

export type PaidEvidence = {
  providerSessionId: string | null;
  orderReference: string | null;
  providerPaymentId: string | null;
  /** Minor units. */
  amount: number;
  currency: string;
};

export type SettleOutcome =
  | { outcome: 'granted'; orderId: string; granted: number }
  | { outcome: 'already_paid'; orderId: string }
  | { outcome: 'order_not_found' }
  | { outcome: 'amount_mismatch'; orderId: string };

function orderFilter(e: { providerSessionId: string | null; orderReference: string | null }): string {
  return [
    e.providerSessionId ? `provider_session_id.eq.${e.providerSessionId}` : null,
    e.orderReference ? `reference.eq.${e.orderReference}` : null,
  ]
    .filter(Boolean)
    .join(',');
}

export async function settlePaid(
  db: SupabaseClient,
  evidence: PaidEvidence,
): Promise<SettleOutcome> {
  // Session id first, reference second. Both come from the provider's
  // own payload or answer, never from a return URL.
  const filter = orderFilter(evidence);
  if (!filter) return { outcome: 'order_not_found' };

  const { data: order } = await db
    .from('orders')
    .select('id, status, email, user_id, reference, total_amount, currency')
    .or(filter)
    .maybeSingle();

  if (!order) return { outcome: 'order_not_found' };
  if (order.status === 'paid') return { outcome: 'already_paid', orderId: order.id };

  // An underpaid or wrong-currency payment never grants. The provider
  // should never send one; if it does, the money sits and a person looks.
  if (evidence.amount !== order.total_amount || evidence.currency !== order.currency) {
    console.error('[payments] amount mismatch', order.reference, evidence.amount, order.total_amount, evidence.currency, order.currency);
    return { outcome: 'amount_mismatch', orderId: order.id };
  }

  // --- The only place paid_at is ever written ---------------------------
  const { data: flipped, error: updateError } = await db
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      provider_payment_id: evidence.providerPaymentId,
    })
    .eq('id', order.id)
    .eq('status', 'pending') // no-op if another caller won the race
    .select('id');

  if (updateError) throw updateError;
  if (!flipped || flipped.length === 0) return { outcome: 'already_paid', orderId: order.id };

  // --- Grant. Bundles fan out inside this function. -----------------------
  const { data: granted, error: grantError } = await db.rpc('grant_entitlements_for_order', {
    p_order_id: order.id,
  });
  if (grantError) throw grantError;

  // A guest checkout grants nothing yet: the order is claimed when the
  // buyer creates an account with the same address. The email says so.
  await sendDeliveryEmail({
    to: order.email,
    orderReference: order.reference,
    orderId: order.id,
    isGuest: !order.user_id,
    amountLabel: formatMoney(order.total_amount, order.currency),
  });

  return { outcome: 'granted', orderId: order.id, granted: Number(granted ?? 0) };
}

export async function settleFailed(
  db: SupabaseClient,
  evidence: { providerSessionId: string | null; orderReference: string | null; reason: string | null },
): Promise<void> {
  const filter = orderFilter(evidence);
  if (!filter) return;
  await db
    .from('orders')
    .update({ status: 'failed', failure_reason: evidence.reason })
    .or(filter)
    .eq('status', 'pending');
}

export async function settleRefunded(
  db: SupabaseClient,
  evidence: { providerPaymentId: string | null },
): Promise<void> {
  if (!evidence.providerPaymentId) return;
  const { data: order } = await db
    .from('orders')
    .select('id')
    .eq('provider_payment_id', evidence.providerPaymentId)
    .maybeSingle();
  if (!order) return;

  await db
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', order.id);

  // Access goes away with the money.
  await db.rpc('revoke_entitlements_for_order', { p_order_id: order.id, p_reason: 'refund' });
}

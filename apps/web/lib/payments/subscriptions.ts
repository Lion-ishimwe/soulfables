import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Keeping the subscriptions table true to PayPal.
 *
 * A subscription row is written from two directions — the reader's
 * return from PayPal, and PayPal's webhooks — and both go through here,
 * so the mapping from PayPal's words to the House's is in one place.
 * Access is never granted in this file: the database rules read the
 * row, and that is the only door.
 */

export type SubscriptionFacts = {
  providerSubscriptionId: string;
  /** PayPal's status word, upper case. */
  status: string;
  /** The custom_id we set: the reader's user id. */
  customId: string | null;
  planId: string | null;
  nextBillingTime: string | null;
  email: string | null;
};

type Status = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'paused';

/**
 * PayPal → the House.
 *
 * APPROVAL_PENDING means the reader has not said yes yet; nothing is
 * written. CANCELLED keeps its period end: a reader who cancels keeps
 * Premium until the month they paid for runs out, which the database
 * rule honours by checking current_period_end.
 */
export function mapStatus(paypal: string): Status | null {
  switch (paypal.toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'SUSPENDED':
      return 'paused';
    case 'CANCELLED':
      return 'cancelled';
    case 'EXPIRED':
      return 'expired';
    case 'APPROVED':
      // Approved but not yet active: PayPal activates within moments.
      return 'active';
    default:
      return null;
  }
}

export async function syncSubscription(db: SupabaseClient, facts: SubscriptionFacts): Promise<{ userId: string | null }> {
  const status = mapStatus(facts.status);
  if (!status) return { userId: null };

  // Find the row this subscription already has, or the reader it is for.
  const { data: existing } = await db
    .from('subscriptions')
    .select('id, user_id, current_period_end')
    .eq('provider_subscription_id', facts.providerSubscriptionId)
    .maybeSingle();

  const userId = (existing?.user_id as string | undefined) ?? facts.customId;
  if (!userId) return { userId: null };

  const { data: plan } = await db.from('plans').select('id').eq('slug', 'resident').single();
  if (!plan) return { userId };

  const periodEnd = facts.nextBillingTime ?? (existing?.current_period_end as string | null) ?? null;
  const now = new Date().toISOString();

  const row = {
    user_id: userId,
    plan_id: plan.id,
    status,
    provider: 'paypal',
    provider_subscription_id: facts.providerSubscriptionId,
    provider_customer_id: facts.email,
    currency: 'USD',
    current_period_start: existing ? undefined : now,
    current_period_end: periodEnd,
    cancel_at_period_end: status === 'cancelled',
    cancelled_at: status === 'cancelled' ? now : null,
    updated_at: now,
  };

  if (existing) {
    await db.from('subscriptions').update(row).eq('id', existing.id);
  } else {
    // One live subscription per reader: anything older steps aside.
    await db
      .from('subscriptions')
      .update({ status: 'cancelled', cancel_at_period_end: true, cancelled_at: now, updated_at: now })
      .eq('user_id', userId)
      .in('status', ['trialing', 'active', 'past_due', 'paused']);
    await db.from('subscriptions').insert(row);
  }

  return { userId };
}

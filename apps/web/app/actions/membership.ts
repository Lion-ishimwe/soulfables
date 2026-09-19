'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { getPlan, setPlanForDemo, type Plan } from '@/lib/membership';
import { getPlanPricing } from '@/lib/plans';
import { getPaymentProvider, isPaymentsConfigured } from '@/lib/payments/provider';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type PlanResult = { error?: string; message?: string };

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

/**
 * Become Premium, or stop.
 *
 * Premium begins with a PayPal subscription: the reader is sent to
 * PayPal to approve it and comes back through the return route, which
 * writes the row from PayPal's answer. Stopping cancels at PayPal and
 * marks the row; the reader keeps Premium until the period they paid
 * for ends, which the database rule honours on its own.
 *
 * The demo has no PayPal and simply moves between tiers, so the paywall
 * and the unlocked state can both be seen.
 */
export async function changePlan(_prev: PlanResult, formData: FormData): Promise<PlanResult> {
  const viewer = await requireViewer('/membership');
  const target = String(formData.get('plan') ?? '') as Plan;
  const interval = String(formData.get('interval') ?? 'month') === 'year' ? 'year' : 'month';
  if (target !== 'free' && target !== 'resident') return { error: 'Unknown tier.' };

  if (isDemoMode()) {
    await setPlanForDemo(target);
    revalidatePath('/membership');
    revalidatePath('/', 'layout');
    return {
      message:
        target === 'resident'
          ? 'You are Premium. Every story, every narration, and the companion are open.'
          : 'Back to Free. Everything you own is still yours.',
    };
  }

  if (!isPaymentsConfigured()) {
    return { error: 'Premium is not on sale yet. The House has not connected its payment account.' };
  }
  const provider = await getPaymentProvider();
  const current = await getPlan();

  if (target === 'resident') {
    if (current === 'resident') return { message: 'You are already Premium.' };
    const pricing = await getPlanPricing();
    const price = interval === 'year' ? pricing.yearly : pricing.monthly;
    if (!price.paypalPlanId) {
      return { error: 'Premium is not on sale yet. The House has not connected this plan at PayPal.' };
    }
    if (!provider.createSubscription) return { error: 'This payment provider cannot take subscriptions.' };

    const origin = await siteOrigin();
    let approvalUrl: string;
    try {
      const created = await provider.createSubscription({
        planId: price.paypalPlanId,
        customId: viewer.id,
        email: viewer.email ?? undefined,
        returnUrl: `${origin}/api/payments/paypal/subscription/return`,
        cancelUrl: `${origin}/membership?cancelled=1`,
      });
      approvalUrl = created.approvalUrl;
    } catch (e) {
      console.error('[membership] create subscription failed', e instanceof Error ? e.message : e);
      return { error: 'PayPal could not start the subscription just now. Try again in a moment.' };
    }
    redirect(approvalUrl as Route);
  }

  // Stopping.
  if (current !== 'resident') return { message: 'You are on Free already.' };
  const supabase = await createClient();
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, provider_subscription_id, current_period_end')
    .in('status', ['trialing', 'active', 'past_due', 'paused'])
    .maybeSingle();
  if (!sub) return { error: 'No subscription was found to stop.' };

  try {
    if (sub.provider_subscription_id && provider.cancelSubscription) {
      await provider.cancelSubscription(sub.provider_subscription_id as string, 'Cancelled from the account page.');
    }
  } catch (e) {
    console.error('[membership] cancel failed', e instanceof Error ? e.message : e);
    return { error: 'PayPal could not cancel just now. Try again, or write to the House.' };
  }

  const now = new Date().toISOString();
  await createAdminClient()
    .from('subscriptions')
    .update({ status: 'cancelled', cancel_at_period_end: true, cancelled_at: now, updated_at: now })
    .eq('id', sub.id);

  revalidatePath('/membership');
  revalidatePath('/', 'layout');
  const until = sub.current_period_end
    ? new Date(sub.current_period_end as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  return {
    message: until
      ? `Premium stops renewing. You keep it until ${until}, and everything you bought outright stays yours.`
      : 'Premium stops renewing. Everything you bought outright stays yours.',
  };
}

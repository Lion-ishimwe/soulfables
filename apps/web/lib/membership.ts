import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { demoPlan, demoSetPlan } from './demo/queries';
import { getViewer } from './auth';

/**
 * Membership.
 *
 * Brief §16: do not hard-code one tier. The plan is a value read from
 * storage, and premium access is a question asked of it — never a
 * hard-coded list of who gets what.
 */
export type Plan = 'free' | 'resident';

export async function getPlan(): Promise<Plan> {
  const viewer = await getViewer();
  if (!viewer) return 'free';

  if (isDemoMode()) return demoPlan();

  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('status, plans(slug)')
    .in('status', ['trialing', 'active'])
    .maybeSingle();

  const slug = (data?.plans as { slug?: string } | null)?.slug;
  return slug === 'resident' ? 'resident' : 'free';
}

export async function hasPremiumAccess(): Promise<boolean> {
  return (await getPlan()) === 'resident';
}

/**
 * Demo-only: move between tiers so the paywall and the unlocked state can
 * both be seen. In live mode this is the provider's job — a subscription
 * is created by a payment, and the webhook writes it back.
 */
export async function setPlanForDemo(plan: Plan): Promise<void> {
  if (!isDemoMode()) return;
  await demoSetPlan(plan);
}

import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';

/**
 * What Premium costs, and how much Free gets.
 *
 * Prices live in plan_prices, one row per interval, with the PayPal
 * plan id beside each once the House has created the plans on PayPal's
 * side. The Free audio allowance lives in house_settings. Both are set
 * from Settings → Membership; nothing here is hard-coded except the
 * demo's stand-ins.
 */

export type Price = {
  id: string | null;
  interval: 'month' | 'year';
  /** Minor units. */
  amount: number;
  currency: string;
  /** PayPal billing plan id (P-…), or null until the House connects one. */
  paypalPlanId: string | null;
};

export type PlanPricing = {
  monthly: Price;
  yearly: Price;
  freeAudioPerMonth: number;
};

const DEMO: PlanPricing = {
  monthly: { id: null, interval: 'month', amount: 799, currency: 'USD', paypalPlanId: null },
  yearly: { id: null, interval: 'year', amount: 6900, currency: 'USD', paypalPlanId: null },
  freeAudioPerMonth: 5,
};

async function fetchPricing(): Promise<PlanPricing> {
  if (isDemoMode()) return DEMO;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const [{ data: prices }, { data: house }] = await Promise.all([
    supabase
      .from('plan_prices')
      .select('id, interval, unit_amount, currency, provider_price_id, plans!inner(slug)')
      .eq('is_active', true)
      .eq('plans.slug', 'resident'),
    supabase.from('house_settings').select('free_audio_per_month').eq('id', 1).maybeSingle(),
  ]);

  const pick = (interval: 'month' | 'year'): Price => {
    const row = (prices ?? []).find((p) => p.interval === interval) as
      | { id: string; interval: string; unit_amount: number; currency: string; provider_price_id: string | null }
      | undefined;
    if (!row) return { ...DEMO[interval === 'month' ? 'monthly' : 'yearly'], id: null };
    return {
      id: row.id,
      interval,
      amount: Number(row.unit_amount),
      currency: (row.currency ?? 'USD').trim().toUpperCase(),
      paypalPlanId: row.provider_price_id || null,
    };
  };

  return {
    monthly: pick('month'),
    yearly: pick('year'),
    freeAudioPerMonth: Number(house?.free_audio_per_month ?? 5),
  };
}

export const getPlanPricing = unstable_cache(fetchPricing, ['plan-pricing'], {
  revalidate: 60,
  tags: ['settings'],
});

/** "$7.99" from minor units. */
export function priceLabel(p: Pick<Price, 'amount' | 'currency'>): string {
  const major = p.amount / 100;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: p.currency, minimumFractionDigits: major % 1 === 0 ? 0 : 2 }).format(major);
  } catch {
    return `${p.currency} ${major.toFixed(2)}`;
  }
}

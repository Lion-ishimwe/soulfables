import type { Metadata } from 'next';
import { getViewer } from '@/lib/auth';
import { getPlan } from '@/lib/membership';
import { getPlanPricing, priceLabel } from '@/lib/plans';
import { isPaymentsConfigured } from '@/lib/payments/provider';
import { isDemoMode } from '@/lib/demo/mode';
import { PlanSwitcher } from '@/components/plan-switcher';

export const metadata: Metadata = {
  title: 'Premium',
  description:
    'Free readers have the run of the library. Premium opens every story and narration, the generated companion, guided journals, sleep stories, early access and your own theme.',
  alternates: { canonical: '/membership' },
};

export const dynamic = 'force-dynamic';

/**
 * The two tiers, as the House offers them.
 *
 * Free is most of the House and always will be. Premium is for the
 * people who keep coming back. The lists are the promise, so a line
 * appears here only when the thing behind it exists.
 */
const FREE = [
  'Story of the day',
  'Your private reading journal',
  'Mood tracker',
  'Five narrated stories a month',
  'A calm line a day',
] as const;

const PREMIUM = [
  'Unlimited stories, including the premium shelves',
  'Unlimited narration',
  'Exclusive series',
  'The generated companion, and a story written for how you feel',
  'Guided journals',
  'Sleep stories',
  'Offline mode',
  'Early access to what is coming',
  'Your own theme',
] as const;

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; pending?: string; cancelled?: string }>;
}) {
  const [{ welcome, pending, cancelled }, viewer, plan, pricing] = await Promise.all([
    searchParams,
    getViewer(),
    getPlan(),
    getPlanPricing(),
  ]);

  const onSale = isDemoMode() || (isPaymentsConfigured() && Boolean(pricing.monthly.paypalPlanId));
  const monthTotal = pricing.monthly.amount * 12;
  const yearSaves =
    monthTotal > pricing.yearly.amount
      ? `save ${Math.round(((monthTotal - pricing.yearly.amount) / monthTotal) * 100)}%`
      : null;
  const free = FREE.map((line) =>
    line === 'Five narrated stories a month' && pricing.freeAudioPerMonth !== 5
      ? `${pricing.freeAudioPerMonth} narrated stories a month`
      : line,
  );

  const notice = welcome
    ? 'Welcome to Premium. Every story, every narration and the companion are open.'
    : pending
      ? 'PayPal has not confirmed the subscription yet. It usually takes a moment; this page will show Premium once it has.'
      : cancelled
        ? 'Nothing was started. You are still on Free.'
        : null;

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">Premium</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          Visit, or live here.
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Most of the House is open to everyone and always will be. Premium is for the people who
          keep coming back.
        </p>
      </header>

      {notice && (
        <p aria-live="polite" className="mx-auto mt-8 max-w-content border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          {notice}
        </p>
      )}

      <div className="mt-14 grid gap-px bg-rule sm:grid-cols-2">
        {/* ---- Free ------------------------------------------------- */}
        <article className={`flex flex-col bg-ink p-8 sm:p-10 ${plan === 'free' ? 'ring-1 ring-inset ring-gold/30' : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl font-light text-ivory">Free</h2>
            {plan === 'free' && (
              <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">Yours</span>
            )}
          </div>
          <p className="mt-3 font-display text-4xl text-gold">Free</p>
          <p className="mt-4 text-sm leading-normal text-grey">The library, the journal, and the Weekly Letter.</p>
          <ul className="mt-7 flex-1 space-y-2.5">
            {free.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-grey-muted">
                <span aria-hidden="true" className="text-gold">✦</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <PlanSwitcher target="free" current={plan} signedIn={Boolean(viewer)} />
          </div>
        </article>

        {/* ---- Premium ---------------------------------------------- */}
        <article className={`flex flex-col bg-ink p-8 sm:p-10 ${plan === 'resident' ? 'ring-1 ring-inset ring-gold/30' : ''}`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl font-light text-ivory">Premium</h2>
            {plan === 'resident' && (
              <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">Yours</span>
            )}
          </div>
          <p className="mt-3 font-display text-4xl text-gold">
            {priceLabel(pricing.monthly)}
            <span className="ml-2 font-ui text-sm text-grey-muted">a month</span>
          </p>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            or {priceLabel(pricing.yearly)} a year{yearSaves ? `, which ${yearSaves.replace('save', 'saves')}` : ''}. Prices include VAT.
          </p>
          <p className="mt-4 text-sm leading-normal text-grey">Everything in the House.</p>
          <ul className="mt-7 flex-1 space-y-2.5">
            {PREMIUM.map((item) => (
              <li key={item} className="flex gap-3 text-sm text-grey-muted">
                <span aria-hidden="true" className="text-gold">✦</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <PlanSwitcher
              target="resident"
              current={plan}
              signedIn={Boolean(viewer)}
              onSale={onSale}
              prices={{ month: priceLabel(pricing.monthly), year: priceLabel(pricing.yearly), yearSaves }}
            />
          </div>
        </article>
      </div>

      <p className="mx-auto mt-10 max-w-measure text-center text-xs leading-normal text-grey-muted">
        Premium renews monthly or yearly through PayPal and you can stop whenever you like; you
        keep it until the period you paid for ends. Anything you have bought outright stays yours
        either way — a book you own is not rented.
      </p>
    </div>
  );
}

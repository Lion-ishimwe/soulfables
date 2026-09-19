'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { changePlan, type PlanResult } from '@/app/actions/membership';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full border border-gold/50 px-6 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'One moment…' : label}
    </button>
  );
}

/**
 * The button on a tier.
 *
 * Premium offers the two intervals side by side and sends the reader to
 * PayPal; the return route writes the subscription. Free, for a Premium
 * reader, is the way to stop renewing.
 */
export function PlanSwitcher({
  target,
  current,
  signedIn,
  prices,
  onSale,
}: {
  target: 'free' | 'resident';
  current: 'free' | 'resident';
  signedIn: boolean;
  prices?: { month: string; year: string; yearSaves: string | null };
  onSale?: boolean;
}) {
  const [state, formAction] = useActionState<PlanResult, FormData>(changePlan, {});
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  if (!signedIn) {
    return (
      <Link
        href={'/signin?next=/membership' as Route}
        className="block w-full border border-rule px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Sign in first
      </Link>
    );
  }

  if (current === target) {
    return (
      <p className="border border-rule px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.18em] text-grey-muted">
        Your current tier
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={target} />
      <input type="hidden" name="interval" value={interval} />

      {target === 'resident' && prices && (
        <div role="radiogroup" aria-label="How often to pay" className="mb-4 grid grid-cols-2 gap-px bg-rule">
          {(['month', 'year'] as const).map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={interval === i}
              onClick={() => setInterval(i)}
              className={`bg-ink px-3 py-3 text-center transition-colors ${
                interval === i ? 'text-ivory ring-1 ring-inset ring-gold/50' : 'text-grey-muted hover:text-ivory'
              }`}
            >
              <span className="block font-display text-lg">{prices[i]}</span>
              <span className="block font-ui text-micro uppercase tracking-[0.14em]">
                {i === 'month' ? 'a month' : 'a year'}
                {i === 'year' && prices.yearSaves ? ` · ${prices.yearSaves}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {state.error && (
        <p role="alert" className="mb-3 text-sm text-state-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mb-3 text-sm text-gold">
          {state.message}
        </p>
      )}

      {target === 'resident' && onSale === false ? (
        <p className="border border-rule px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.18em] text-grey-muted">
          Not on sale yet
        </p>
      ) : (
        <Submit label={target === 'resident' ? 'Become Premium' : 'Stop renewing'} />
      )}
    </form>
  );
}

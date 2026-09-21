'use client';

import { usePathname } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { startCheckout, type CheckoutResult } from '@/app/actions/checkout';


function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full border border-gold/50 px-10 py-4 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Opening the counter…' : label}
    </button>
  );
}

/**
 * The buy control.
 *
 * Note what is not here: no price, no amount, no product id. The form
 * posts a slug and nothing else, and the server reads the price from the
 * database. There is deliberately no field a tampered client could use to
 * name its own price.
 *
 * Guest checkout is allowed — asking someone to make an account before
 * they have bought anything loses sales — so signed-out buyers get an
 * email field, and the order is claimed when they sign up with it later.
 */
export function BuyForm({ slug, ctaLabel }: { slug: string; ctaLabel: string }) {
  const [state, formAction] = useActionState<CheckoutResult, FormData>(
    startCheckout,
    {},
  );
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { signedIn: boolean }) => active && setSignedIn(me.signedIn))
      .catch(() => active && setSignedIn(false));
    return () => {
      active = false;
    };
  }, [pathname]);

  return (
    <form action={formAction} className="mt-8">
      <input type="hidden" name="slug" value={slug} />

      {state.error && (
        <p
          role="alert"
          className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-left text-sm text-ivory"
        >
          {state.error}
        </p>
      )}

      {signedIn === false && (
        <div className="mb-4 text-left">
          <label htmlFor="buy-email" className="sf-eyebrow mb-2 block">
            Email
          </label>
          <input
            id="buy-email"
            name="email"
            type="email"
            required
            placeholder="where should we send it?"
            className="w-full border border-rule bg-ink-raised px-4 py-3 font-ui text-base text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
          />
          <p className="mt-2 text-xs text-grey-muted">
            Your book is tied to this address. Use the same one if you make an
            account later and it will be waiting.
          </p>
        </div>
      )}

      {/*
        Digital goods delivered at once: under EU consumer law the buyer
        agrees to immediate delivery and, with it, gives up the statutory
        right to withdraw. Said in one sentence, ticked, and recorded with
        the order — not buried in a page nobody opens.
      */}
      <label className="mb-5 flex items-start gap-2.5 text-left font-ui text-xs leading-relaxed text-grey-muted">
        <input type="checkbox" name="consent" value="1" required className="mt-0.5 h-3.5 w-3.5 flex-none accent-[#C89528]" />
        <span>
          I want the book delivered to my library straight away, and I understand that once it
          is, the legal right to withdraw no longer applies; refunds follow the House's seven-day
          policy. I have read the{' '}
          <a href="/terms" className="text-gold hover:text-gold-soft">terms</a> and the{' '}
          <a href="/digital-products" className="text-gold hover:text-gold-soft">digital products policy</a>.
          The price includes VAT.
        </span>
      </label>

      <Submit label={ctaLabel} />
    </form>
  );
}

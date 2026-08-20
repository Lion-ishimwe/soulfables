'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { startCheckout, type CheckoutResult } from '@/app/actions/checkout';
import { createClient } from '@/lib/supabase/client';

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

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setSignedIn(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

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

      <Submit label={ctaLabel} />
    </form>
  );
}

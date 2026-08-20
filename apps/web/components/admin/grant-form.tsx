'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { grantEntitlement, type GrantResult } from '@/app/actions/entitlements';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Granting…' : 'Grant access'}
    </button>
  );
}

export function GrantForm({
  products,
}: {
  products: { value: string; label: string }[];
}) {
  const [state, formAction] = useActionState<GrantResult, FormData>(
    grantEntitlement,
    {},
  );

  if (products.length === 0) {
    return (
      <p className="text-sm text-grey-muted">
        Publish a product first — there is nothing to grant yet.
      </p>
    );
  }

  return (
    <form action={formAction}>
      {state.error && (
        <p
          role="alert"
          className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          aria-live="polite"
          className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="g-email" className="sf-eyebrow mb-2 block">
            Reader&rsquo;s email
          </label>
          <input
            id="g-email"
            name="email"
            type="email"
            required
            placeholder="they must already have an account"
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
          />
        </div>

        <div>
          <label htmlFor="g-product" className="sf-eyebrow mb-2 block">
            Product
          </label>
          <select
            id="g-product"
            name="productId"
            required
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
          >
            {products.map((p) => (
              <option key={p.value} value={p.value} className="bg-ink">
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="g-note" className="sf-eyebrow mb-2 block">
          Why
        </label>
        <input
          id="g-note"
          name="note"
          placeholder="e.g. bought on the old site, March 2026"
          className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
        />
        <p className="mt-1.5 text-xs text-grey-muted">
          Kept on the record. Six months from now this is the only thing that
          explains the grant.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <Submit />
        <label className="flex items-center gap-2.5 text-sm text-grey">
          <input
            type="checkbox"
            name="notify"
            defaultChecked
            className="h-3.5 w-3.5 accent-[#C89528]"
          />
          Email them that it is ready
        </label>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { subscribeToLetter, type LetterResult } from '@/app/actions/letter';

function Join() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-none rounded bg-gold px-6 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? 'One moment…' : 'Join the House'}
    </button>
  );
}

/** The one field the letter needs. */
export function LetterForm({ source = 'letter', defaultEmail = '' }: { source?: string; defaultEmail?: string }) {
  const [state, formAction] = useActionState<LetterResult, FormData>(subscribeToLetter, {});

  if (state.message) {
    return (
      <p aria-live="polite" className="mx-auto max-w-measure border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-left font-ui text-sm text-ivory">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-md">
      <input type="hidden" name="source" value={source} />
      <label htmlFor="letter-email" className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="letter-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          placeholder="your@address"
          className="w-full border border-rule-strong bg-ink-hover px-4 py-3 font-ui text-base text-ivory outline-none placeholder:text-grey-muted focus:border-gold/50"
        />
        <Join />
      </div>
      {state.error && (
        <p role="alert" className="mt-3 text-left font-ui text-sm text-state-danger">
          {state.error}
        </p>
      )}
      <p className="mt-3 font-ui text-xs text-grey-muted">
        One letter a week, and a line to leave whenever you like. Nothing else, ever.
      </p>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAffirmation, type CardResult } from '@/app/actions/questions';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="whitespace-nowrap border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Add it'}
    </button>
  );
}

/** One line in, one line added to the day's rotation. */
export function AffirmationForm({ readOnly }: { readOnly: boolean }) {
  const [state, formAction] = useActionState<CardResult, FormData>(saveAffirmation, {});
  return (
    <form action={formAction} className="border border-rule p-6">
      <p className="sf-eyebrow mb-4">A new affirmation</p>
      {state.error && (
        <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="f-affirmation" className="sr-only">
            The line
          </label>
          <input
            id="f-affirmation"
            name="body"
            required
            maxLength={200}
            placeholder="Rest is a way of continuing."
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
          />
          <p className="mt-1.5 text-xs text-grey-muted">
            One calm sentence. It tells; it does not ask. The day picks one from the rotation.
          </p>
        </div>
        {readOnly ? (
          <p className="font-ui text-xs text-grey-muted">The demo keeps its lines as they are.</p>
        ) : (
          <Save />
        )}
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { narrateEverything, type NarrateAllResult } from '@/app/actions/audio';

function Go() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Starting…' : 'Read them aloud'}
    </button>
  );
}

/** Catch-up for stories published before narration was automatic. */
export function NarrateEverything() {
  const [state, action] = useActionState<NarrateAllResult, FormData>(narrateEverything, {});
  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-rule bg-ink-raised px-5 py-4">
      <div className="min-w-0">
        <p className="font-ui text-sm text-ivory">Stories without a narration</p>
        <p className="mt-0.5 font-ui text-micro text-grey-faint">
          The House reads these on its own — soon after it starts, and every few hours. This reads them now
          rather than waiting.
        </p>
        {state.error && <p role="alert" className="mt-2 font-ui text-xs text-state-danger">{state.error}</p>}
        {state.message && <p aria-live="polite" className="mt-2 font-ui text-xs text-gold">{state.message}</p>}
      </div>
      <Go />
    </form>
  );
}

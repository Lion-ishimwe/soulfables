'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { decideRefund, type RefundResult } from '@/app/actions/refunds';

const btn = 'whitespace-nowrap border px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] transition-all disabled:opacity-50';

function Buttons({ amountLabel }: { amountLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        name="decision"
        value="refund"
        disabled={pending}
        className={`${btn} border-gold/50 text-gold hover:bg-gold hover:text-ink`}
      >
        {pending ? 'Working…' : `Refund ${amountLabel}`}
      </button>
      <button
        type="submit"
        name="decision"
        value="decline"
        disabled={pending}
        className={`${btn} border-rule text-grey-muted hover:border-state-danger/60 hover:text-ivory`}
      >
        Decline
      </button>
    </div>
  );
}

/**
 * The two buttons on a request, and the note that goes with either.
 *
 * Refund sends the money back through the provider before anything
 * else changes; Decline needs a sentence, because the reader reads it.
 */
export function RefundDecision({ requestId, amountLabel }: { requestId: string; amountLabel: string }) {
  const [state, formAction] = useActionState<RefundResult, FormData>(decideRefund, {});

  if (state.message) {
    return <p className="font-ui text-sm text-state-success">{state.message}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="note"
        rows={2}
        maxLength={1000}
        placeholder="A line to the reader. Required to decline; sent with a refund if written."
        className="w-full border border-rule bg-ink px-3 py-2 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/60"
      />
      {state.error && (
        <p role="alert" className="border-l-2 border-state-danger bg-state-danger/10 px-3 py-2 font-ui text-sm text-ivory">
          {state.error}
        </p>
      )}
      <Buttons amountLabel={amountLabel} />
    </form>
  );
}

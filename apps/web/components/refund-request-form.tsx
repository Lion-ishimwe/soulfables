'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestRefund, type RefundResult } from '@/app/actions/refunds';

type Reason = 'faulty' | 'changed_mind' | 'duplicate' | 'other';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Ask for a refund'}
    </button>
  );
}

/**
 * The reader's side of a refund.
 *
 * Folded shut under the receipt, because most receipts are only kept.
 * Open, it offers the grounds the policy allows, each with its window
 * written next to it, and room for a few words. The server checks the
 * windows again and answers in a sentence.
 */
export function RefundRequestForm({
  orderId,
  faultyOpen,
  changeOfMindOpen,
  downloaded,
}: {
  orderId: string;
  faultyOpen: boolean;
  changeOfMindOpen: boolean;
  downloaded: boolean;
}) {
  const [state, formAction] = useActionState<RefundResult, FormData>(requestRefund, {});
  const [reason, setReason] = useState<Reason>(faultyOpen ? 'faulty' : 'duplicate');

  if (state.message) {
    return (
      <p role="status" className="border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
        {state.message}
      </p>
    );
  }

  const options: { value: Reason; label: string; hint: string; open: boolean }[] = [
    {
      value: 'faulty',
      label: 'Something is wrong with it',
      hint: 'A file that will not open, a missing format, a book that is not what its page described. Within thirty days.',
      open: faultyOpen,
    },
    {
      value: 'changed_mind',
      label: 'I changed my mind',
      hint: downloaded
        ? 'No longer possible: a file of this book has been downloaded.'
        : 'Within fourteen days, if no file has been downloaded.',
      open: changeOfMindOpen,
    },
    { value: 'duplicate', label: 'I bought it twice', hint: 'Refunded whenever you notice.', open: true },
    { value: 'other', label: 'Something else', hint: 'Say what, and a person will read it.', open: true },
  ];

  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-ui text-sm text-gold transition-colors hover:text-gold-soft">
        Ask for a refund
        <span className="ml-2 font-ui text-xs text-grey-muted">Money comes back within the windows the digital products policy sets out.</span>
      </summary>

      <form action={formAction} className="mt-5 space-y-5 border-t border-rule pt-5">
        <input type="hidden" name="orderId" value={orderId} />

        <fieldset className="space-y-3">
          <legend className="sf-eyebrow mb-3">Why</legend>
          {options.map((o) => (
            <label key={o.value} className={`flex gap-3 ${o.open ? '' : 'opacity-50'}`}>
              <input
                type="radio"
                name="reason"
                value={o.value}
                checked={reason === o.value}
                disabled={!o.open}
                onChange={() => setReason(o.value)}
                className="mt-1 accent-[var(--gold)]"
              />
              <span>
                <span className="block font-ui text-sm text-ivory">{o.label}</span>
                <span className="block font-ui text-xs leading-relaxed text-grey-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="block">
          <span className="sf-eyebrow">A few words{reason === 'other' ? '' : ', if you like'}</span>
          <textarea
            name="message"
            rows={3}
            maxLength={2000}
            required={reason === 'other'}
            className="mt-2 w-full border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/60"
            placeholder={reason === 'faulty' ? 'Which file, and what happens when you open it.' : ''}
          />
        </label>

        {state.error && (
          <p role="alert" className="border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </details>
  );
}

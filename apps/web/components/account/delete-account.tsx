'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteOwnAccount, type AccountResult } from '@/app/actions/account';

function Confirm({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      className="border border-state-danger/60 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-state-danger transition-all hover:bg-state-danger hover:text-ivory disabled:opacity-40"
    >
      {pending ? 'Leaving…' : 'Delete my account'}
    </button>
  );
}

/**
 * Leaving the House.
 *
 * Deletion is real and immediate: the account, the journal, the shelf,
 * the reading history. What stays is the paper — receipts for money
 * that changed hands — with the account unlinked from it, because the
 * law asks a business to keep those. It is said here in the same words
 * the privacy page uses, and it takes the word typed to be sure.
 */
export function DeleteAccount({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, formAction] = useActionState<AccountResult, FormData>(deleteOwnAccount, {});

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger">
        Delete my account
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-4 max-w-measure border border-state-danger/40 p-6">
      <p className="font-display text-xl text-ivory">Leave the House for good?</p>
      <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">
        This deletes your account{email ? ` (${email})` : ''}, your journal, your shelf and your
        reading history, now and for good. Receipts for anything you bought are kept, as the law
        requires, with your account no longer attached to them. Downloads you have not made will
        not be possible afterwards.
      </p>
      {state.error && (
        <p role="alert" className="mt-4 border-l-2 border-state-danger bg-state-danger/10 px-3 py-2 font-ui text-sm text-ivory">
          {state.error}
        </p>
      )}
      <label htmlFor="delete-word" className="sf-eyebrow mb-2 mt-5 block">
        Type <span className="normal-case tracking-normal text-ivory">delete</span> to confirm
      </label>
      <input
        id="delete-word"
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="w-full border border-rule-strong bg-ink-hover px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-state-danger/60"
      />
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Confirm ready={typed.trim().toLowerCase() === 'delete'} />
        <button type="button" onClick={() => { setOpen(false); setTyped(''); }} className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory">
          Stay
        </button>
      </div>
    </form>
  );
}

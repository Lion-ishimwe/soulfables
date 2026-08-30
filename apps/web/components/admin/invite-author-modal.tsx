'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createAuthorAccount, type WorkflowResult } from '@/app/actions/workflow';
import { Quill } from './quill';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded bg-gold px-5 py-2.5 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
      {pending ? 'Creating…' : 'Give them an account'}
    </button>
  );
}

/**
 * A way in, for an author who already has a byline.
 *
 * This used to be a permanent panel above the table with a dropdown of
 * every author who lacked an account. It stopped earning that space the
 * moment New author started creating the account too: the panel was a
 * standing invitation to fix a problem that no longer happens by
 * default, and it was the first thing on the page.
 *
 * So it moved to where the answer already is. The Account column says
 * "Not invited yet"; the button to fix that is in the same cell, and it
 * knows which author it belongs to — which also removes the dropdown,
 * and with it the chance of inviting the wrong person.
 */
export function InviteAuthorModal({
  authorSlug,
  authorName,
}: {
  authorSlug: string;
  authorName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<WorkflowResult, FormData>(
    createAuthorAccount,
    {},
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    emailRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Stays open on success: the temporary password is shown once, and
  // closing would throw it away before anyone could copy it.
  useEffect(() => {
    if (state.message) router.refresh();
  }, [state.message, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
      >
        Give them an account
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => {
            if (!dialogRef.current?.contains(e.target as Node)) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="my-8 w-full max-w-xl overflow-hidden rounded-lg border border-rule bg-ink-raised shadow-2xl"
          >
            <div className="relative">
              <div className="pointer-events-none absolute -right-6 -top-4 hidden opacity-70 sm:block">
                <Quill className="h-36 w-36" />
              </div>

              <div className="relative p-6 sm:pr-36">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="invite-title" className="font-display text-2xl text-ivory">
                      Give a writer access
                    </h2>
                    <p className="mt-1.5 max-w-prose font-ui text-sm leading-relaxed text-grey-muted">
                      {authorName} can write, upload and send work in. They cannot
                      publish — that stays with the House, which is the point of the
                      review step.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="shrink-0 rounded p-1 text-grey-muted transition-colors hover:text-ivory sm:hidden"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <form action={formAction} className="px-6 pb-6">
              <input type="hidden" name="authorSlug" value={authorSlug} />

              {state.error && (
                <p
                  role="alert"
                  className="mb-4 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
                >
                  {state.error}
                </p>
              )}

              {state.message ? (
                <>
                  <p
                    aria-live="polite"
                    className="rounded border-l-2 border-state-success bg-state-success/10 px-4 py-4 font-ui text-sm leading-relaxed text-ivory"
                  >
                    {state.message}
                  </p>
                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded border border-rule px-6 py-2.5 font-ui text-sm text-ivory transition-colors hover:border-rule-strong"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor={`invite-${authorSlug}`} className="mb-2 block font-ui text-sm text-ivory">
                    Their email <span className="text-gold">*</span>
                  </label>
                  <input
                    ref={emailRef}
                    id={`invite-${authorSlug}`}
                    name="email"
                    type="email"
                    required
                    placeholder="writer@example.com"
                    className="w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
                  />
                  <p className="mt-2 font-ui text-xs text-grey-muted">
                    How they sign in. A temporary password is shown once, here, for
                    you to pass on.
                  </p>

                  <div className="mt-6 flex justify-end gap-3 border-t border-rule pt-5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded border border-rule px-5 py-2.5 font-ui text-sm text-ivory transition-colors hover:border-rule-strong"
                    >
                      Cancel
                    </button>
                    <Submit />
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

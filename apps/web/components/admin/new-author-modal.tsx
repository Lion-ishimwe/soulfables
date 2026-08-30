'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createAuthorWithAccount, type WorkflowResult } from '@/app/actions/workflow';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded bg-gold px-6 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h11v-1c0-2.8 3.6-5 8-5h-11Zm9-2h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" />
      </svg>
      {pending ? 'Adding…' : 'Add author'}
    </button>
  );
}

/**
 * Adding a writer, without leaving the list.
 *
 * Three fields, and every omission is deliberate:
 *
 *   House voice — an author is a person. The Librarian exists and can
 *     still be edited, but a persona is a rare editorial object and
 *     making it the second thing on this form implied otherwise.
 *   Web address — derived from the name, and editable afterwards. Being
 *     asked to invent a URL for a colleague is a strange first question.
 *   Portrait — nobody has the file to hand at this moment. The edit page
 *     takes it later.
 *   Order — appended to the end. A position in a list is not a fact
 *     about a person.
 *
 * Email is here because it is what turns a byline into someone who can
 * actually write: the account is created with the author, not bolted on
 * in a second step that was easy to forget.
 */
export function NewAuthorModal() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<WorkflowResult, FormData>(
    createAuthorWithAccount,
    {},
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Escape closes it, the way every other dialog on the machine does.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // The page behind must not scroll while a dialog is over it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstFieldRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /*
   * Stay open on success.
   *
   * The result carries a temporary password that is shown exactly once —
   * closing the dialog the moment it succeeds would throw it away before
   * anyone could copy it. The list refreshes underneath instead.
   */
  useEffect(() => {
    if (state.message) router.refresh();
  }, [state.message, router]);

  const field =
    'w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';
  const label = 'mb-2 block font-ui text-sm text-ivory';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded border border-gold/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink"
      >
        <span aria-hidden="true" className="text-base leading-none">+</span>
        New author
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/80 p-4 backdrop-blur-sm sm:items-center"
          // A click on the backdrop closes; a click that started inside
          // the panel and ended outside it does not.
          onMouseDown={(e) => {
            if (!dialogRef.current?.contains(e.target as Node)) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-author-title"
            className="my-8 w-full max-w-3xl rounded-lg border border-rule bg-ink-raised shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 p-6 pb-0">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h11v-1c0-2.8 3.6-5 8-5h-11Zm9-2h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" />
                  </svg>
                </span>
                <div>
                  <h2 id="new-author-title" className="font-display text-2xl text-ivory">
                    New author
                  </h2>
                  <p className="mt-1 font-ui text-sm text-grey-muted">
                    A person who writes for the House, and can sign in to do it.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 rounded p-1 text-grey-muted transition-colors hover:text-ivory"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form action={formAction} className="p-6">
              {state.error && (
                <p
                  role="alert"
                  className="mb-5 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
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
                      className="rounded border border-rule px-6 py-3 font-ui text-sm text-ivory transition-colors hover:border-rule-strong"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="na-name" className={label}>
                        Name <span className="text-gold">*</span>
                      </label>
                      <input
                        ref={firstFieldRef}
                        id="na-name"
                        name="name"
                        required
                        maxLength={120}
                        placeholder="e.g. Apophia Kamwine"
                        className={field}
                      />
                      <p className="mt-2 font-ui text-xs text-grey-muted">
                        Their byline. The web address follows from it.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="na-email" className={label}>
                        Email <span className="text-gold">*</span>
                      </label>
                      <input
                        id="na-email"
                        name="email"
                        type="email"
                        required
                        placeholder="writer@example.com"
                        className={field}
                      />
                      <p className="mt-2 font-ui text-xs text-grey-muted">
                        How they sign in. They can write and submit, never publish.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="na-bio" className={label}>
                      Biography
                    </label>
                    <textarea
                      id="na-bio"
                      name="bio"
                      rows={4}
                      maxLength={2000}
                      placeholder="Tell readers about this author…"
                      className={`${field} resize-y`}
                    />
                    <p className="mt-2 font-ui text-xs text-grey-muted">
                      Shown on their story pages. Optional — they can write their own
                      once they are in, and most would rather.
                    </p>
                  </div>

                  <div className="mt-7 flex justify-end gap-3 border-t border-rule pt-5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded border border-rule px-6 py-3 font-ui text-sm text-ivory transition-colors hover:border-rule-strong"
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

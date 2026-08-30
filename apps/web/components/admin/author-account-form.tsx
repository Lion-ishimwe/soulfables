'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createAuthorAccount,
  type WorkflowResult,
} from '@/app/actions/workflow';
import { Quill } from './quill';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2.5 rounded border border-gold/60 px-6 py-3 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
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
 * Give an author a way in.
 *
 * An account is attached to an existing author record rather than
 * creating a new one, so the byline and the login are the same person by
 * construction. House voices are excluded from the list — The Librarian
 * has nobody to send a password to.
 *
 * The sentence under the heading is doing real work and is not filler:
 * an author can write and submit but cannot publish, and somebody
 * handing out access deserves to know that before they hand it out
 * rather than after.
 */
export function AuthorAccountForm({
  authors,
}: {
  authors: { slug: string; name: string }[];
}) {
  const [state, formAction] = useActionState<WorkflowResult, FormData>(
    createAuthorAccount,
    {},
  );

  if (authors.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-ink-raised px-6 py-5">
        <p className="font-ui text-sm text-grey-muted">
          Every author who can have an account already has one. Add an author
          first, then give them a way in.
        </p>
      </div>
    );
  }

  const field =
    'w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';
  const label = 'mb-2 block font-ui text-micro uppercase tracking-[0.14em] text-grey-muted';

  return (
    <form action={formAction} className="relative overflow-hidden rounded-lg border border-rule bg-ink-raised">
      {/*
        The illustration is decorative and sits behind the fields at
        narrow widths rather than pushing them around. It is hidden below
        `lg` entirely — on a phone the form needs the whole width, and a
        quill is not worth a line break.
      */}
      <div className="pointer-events-none absolute -right-4 top-1/2 hidden -translate-y-1/2 opacity-90 lg:block">
        <Quill className="h-52 w-52" />
      </div>

      <div className="relative p-6 lg:pr-56">
        <div className="mb-5 flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.5-8 5.5V21h16v-1.5c0-3-3.6-5.5-8-5.5Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ivory">Give a writer access</h2>
            <p className="mt-1.5 max-w-prose font-ui text-sm leading-relaxed text-grey-muted">
              They can write, upload, and send work in. They cannot publish — that
              stays with the House, which is the point of the review step.
            </p>
          </div>
        </div>

        {state.error && (
          <p
            role="alert"
            className="mb-4 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
          >
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            aria-live="polite"
            className="mb-4 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory"
          >
            {state.message}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="acc-author" className={label}>
              Writing as
            </label>
            <div className="relative">
              <select
                id="acc-author"
                name="authorSlug"
                required
                className={`${field} cursor-pointer appearance-none pr-10`}
              >
                {authors.map((a) => (
                  <option key={a.slug} value={a.slug} className="bg-ink">
                    {a.name}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-grey-muted">
                ▾
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="acc-email" className={label}>
              Their email
            </label>
            <input
              id="acc-email"
              name="email"
              type="email"
              required
              placeholder="writer@example.com"
              className={field}
            />
          </div>
        </div>

        <div className="mt-6">
          <Submit />
        </div>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createAuthorAccount,
  type WorkflowResult,
} from '@/app/actions/workflow';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
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
      <p className="border border-rule px-6 py-5 text-sm text-grey-muted">
        Every author who can have an account already has one. Add an author
        first, then give them a way in.
      </p>
    );
  }

  return (
    <form action={formAction} className="border border-rule p-6">
      <p className="sf-eyebrow mb-2">Give a writer access</p>
      <p className="mb-5 max-w-prose text-sm leading-normal text-grey-muted">
        They can write, upload, and send work in. They cannot publish — that
        stays with the House, which is the point of the review step.
      </p>

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
          <label htmlFor="acc-author" className="sf-eyebrow mb-2 block">
            Writing as
          </label>
          <select
            id="acc-author"
            name="authorSlug"
            required
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          >
            {authors.map((a) => (
              <option key={a.slug} value={a.slug} className="bg-ink">
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="acc-email" className="sf-eyebrow mb-2 block">
            Their email
          </label>
          <input
            id="acc-email"
            name="email"
            type="email"
            required
            placeholder="writer@example.com"
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
          />
        </div>
      </div>

      <div className="mt-5">
        <Submit />
      </div>
    </form>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateOwnBio, type WorkflowResult } from '@/app/actions/workflow';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-gold/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

/**
 * An author, describing themselves.
 *
 * Until now only staff could write to the authors table, so the person
 * whose name is on the page had to ask somebody else to fix their own
 * description of themselves. Migration 0017 gives them one column and
 * only that one — they can rewrite their biography, and cannot rename
 * themselves, change their URL, or reorder the author list.
 *
 * Collapsed by default. This is not the reason anybody opens the writing
 * room, and an open textarea at the top of the page would suggest
 * otherwise.
 */
export function BioEditor({ bio, name }: { bio: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<WorkflowResult, FormData>(updateOwnBio, {});

  return (
    <section className="mb-12 border border-rule">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-ui text-sm text-ivory">How readers see you</h2>
          <p className="mt-1 max-w-prose font-ui text-sm leading-relaxed text-grey-muted">
            {bio ? bio : `Nothing yet — your stories carry just the name ${name}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
        >
          {open ? 'Cancel' : bio ? 'Edit' : 'Write one'}
        </button>
      </div>

      {open && (
        <form action={formAction} className="border-t border-rule px-5 py-5">
          {state.error && (
            <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
              {state.error}
            </p>
          )}
          {state.message && (
            <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
              {state.message}
            </p>
          )}

          <label htmlFor="own-bio" className="mb-2 block font-ui text-sm text-ivory">
            Your biography
          </label>
          <textarea
            id="own-bio"
            name="bio"
            rows={5}
            maxLength={2000}
            defaultValue={bio ?? ''}
            placeholder="A few sentences. What you write about, and why."
            className="w-full resize-y rounded border border-rule bg-ink px-4 py-3 font-reading text-base leading-relaxed text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
          />
          <p className="mt-2 font-ui text-xs text-grey-muted">
            Shown on every story with your name on it. Up to 2000 characters.
          </p>

          <div className="mt-4">
            <Save />
          </div>
        </form>
      )}
    </section>
  );
}

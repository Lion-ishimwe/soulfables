'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { reassignStory, type WorkflowResult } from '@/app/actions/workflow';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Handing it on…' : 'Hand it on'}
    </button>
  );
}

/**
 * Give an unfinished story to a different writer.
 *
 * The note matters more than it looks — someone opening a story they did
 * not start needs to know what is wanted from them, and "you have been
 * assigned a story" answers none of that.
 *
 * Published stories are not offered here. Handing on a finished piece is
 * not continuation, it is rewriting something readers have already read.
 */
export function ReassignForm({
  stories,
  authors,
}: {
  stories: { slug: string; title: string }[];
  authors: { slug: string; name: string }[];
}) {
  const [state, formAction] = useActionState<WorkflowResult, FormData>(
    reassignStory,
    {},
  );

  if (stories.length === 0) {
    return (
      <p className="border border-rule px-6 py-5 text-sm text-grey-muted">
        Nothing unfinished to hand on. Published stories stay with whoever
        finished them.
      </p>
    );
  }

  return (
    <form action={formAction} className="border border-rule p-6">
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
          <label htmlFor="ra-story" className="sf-eyebrow mb-2 block">
            Which story
          </label>
          <select
            id="ra-story"
            name="slug"
            required
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          >
            {stories.map((s) => (
              <option key={s.slug} value={s.slug} className="bg-ink">
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ra-author" className="sf-eyebrow mb-2 block">
            To whom
          </label>
          <select
            id="ra-author"
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
      </div>

      <div className="mt-4">
        <label htmlFor="ra-note" className="sf-eyebrow mb-2 block">
          What do they need to know?
        </label>
        <textarea
          id="ra-note"
          name="note"
          rows={2}
          placeholder="The first two sections are done. It wants an ending that does not resolve everything."
          className="w-full resize-y border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-5">
        <Submit />
        <span className="max-w-md text-xs leading-normal text-grey-muted">
          The byline does not move. Whoever began it keeps the credit — this
          only changes who may work on it next.
        </span>
      </div>
    </form>
  );
}

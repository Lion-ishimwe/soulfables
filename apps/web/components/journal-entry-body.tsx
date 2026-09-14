'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateEntry, type JournalResult } from '@/app/actions/journal';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/60 px-5 py-2 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Keeping…' : 'Keep the change'}
    </button>
  );
}

/**
 * The body of a reflection, and the way to change it.
 *
 * A reflection written at midnight usually wants a word changed in the
 * morning, and until now the only tool was delete. Editing happens in
 * place — the entry stays where it was read, the fields appear over the
 * words, and the words come back changed. Nothing else about the entry
 * (its date, its story, its feeling) is touched: those are what the
 * reflection was about, and rewriting history is not the same as
 * choosing a better word.
 */
export function JournalEntryBody({
  id,
  title,
  body,
}: {
  id: string;
  title: string | null;
  body: string;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<JournalResult, FormData>(
    async (prev, formData) => {
      const result = await updateEntry(prev, formData);
      if (!result.error) setEditing(false);
      return result;
    },
    {},
  );

  const field =
    'w-full border border-rule-strong bg-ink-hover px-4 py-3 font-reading text-base leading-relaxed text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50';

  if (!editing) {
    return (
      <>
        {title && <h3 className="mb-3 font-display text-2xl text-ivory">{title}</h3>}
        <p className="whitespace-pre-wrap font-reading text-base leading-relaxed text-grey">{body}</p>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
          >
            Change a word
          </button>
          {state.message && (
            <span aria-live="polite" className="font-ui text-xs text-gold">
              {state.message}
            </span>
          )}
        </div>
      </>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`title-${id}`} className="sr-only">
        Title
      </label>
      <input
        id={`title-${id}`}
        name="title"
        defaultValue={title ?? ''}
        maxLength={200}
        placeholder="A title, if it wants one"
        className={`${field} mb-3 font-display text-xl`}
      />
      <label htmlFor={`body-${id}`} className="sr-only">
        Reflection
      </label>
      <textarea
        id={`body-${id}`}
        name="body"
        defaultValue={body}
        rows={Math.min(18, Math.max(5, body.split('\n').length + 2))}
        required
        className={`${field} resize-y`}
      />
      {state.error && (
        <p role="alert" className="mt-3 border-l-2 border-state-danger bg-state-danger/10 px-3 py-2 font-ui text-sm text-ivory">
          {state.error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Save />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
        >
          Leave it as it was
        </button>
      </div>
    </form>
  );
}

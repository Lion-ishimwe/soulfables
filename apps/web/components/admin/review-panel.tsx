'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { approveStory, returnStory } from '@/app/actions/workflow';

function Submit({ label, danger }: { label: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] transition-all disabled:opacity-50 ${
        danger
          ? 'border-rule text-grey-muted hover:border-ivory/30 hover:text-ivory'
          : 'border-gold/50 text-gold hover:bg-gold hover:text-ink'
      }`}
    >
      {pending ? 'One moment…' : label}
    </button>
  );
}

/**
 * Approve, or send back.
 *
 * Sending back asks for a note, and the note is the point — "not yet" on
 * its own tells a writer nothing they can act on. It is optional rather
 * than required, because sometimes a conversation has already happened
 * elsewhere and forcing a duplicate is just friction.
 */
export function ReviewPanel({ slug, title }: { slug: string; title: string }) {
  const [returning, setReturning] = useState(false);

  if (returning) {
    return (
      <form action={returnStory} className="border border-rule p-5">
        <input type="hidden" name="slug" value={slug} />

        <label htmlFor={`note-${slug}`} className="sf-eyebrow mb-2 block">
          What would make it ready?
        </label>
        <textarea
          id={`note-${slug}`}
          name="note"
          rows={3}
          autoFocus
          placeholder="The ending arrives too quickly — give the last section room."
          className="w-full resize-y border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
        />
        <p className="mt-2 text-xs text-grey-muted">
          The author sees this, and only this. Say the useful thing.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Submit label="Send it back" danger />
          <button
            type="button"
            onClick={() => setReturning(false)}
            className="border border-rule px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={approveStory}>
        <input type="hidden" name="slug" value={slug} />
        <Submit label="Approve and publish" />
      </form>

      <button
        type="button"
        onClick={() => setReturning(true)}
        className="border border-rule px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:border-ivory/30 hover:text-ivory"
      >
        Send back with a note
      </button>

      <span className="text-xs text-grey-muted">
        Publishing “{title}” makes it visible to everyone immediately.
      </span>
    </div>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveEntry, type JournalResult } from '@/app/actions/journal';
import type { Mood, Prompt } from '@/lib/journal';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Keeping…' : 'Save entry'}
    </button>
  );
}

/**
 * One quiet page. No pressure.
 *
 * The AI consent control is the part worth reading carefully: it is off
 * unless deliberately turned on, it is per entry rather than per account,
 * and its label says what actually happens rather than asking for
 * permission in the abstract.
 */
export function JournalComposer({
  moods,
  prompt,
  storyId,
  storyTitle,
  signedIn,
}: {
  moods: Mood[];
  prompt: Prompt | null;
  storyId?: string;
  storyTitle?: string;
  signedIn: boolean;
}) {
  const [state, formAction] = useActionState<JournalResult, FormData>(
    saveEntry,
    {},
  );
  const [mood, setMood] = useState<string>('');
  const [body, setBody] = useState('');

  if (!signedIn) {
    return (
      <div className="border border-rule p-10 text-center">
        <p className="sf-eyebrow">Today&rsquo;s question</p>
        {prompt && (
          <p className="mx-auto mt-4 max-w-measure font-display text-2xl font-light italic leading-snug text-ivory">
            {prompt.body}
          </p>
        )}
        <p className="mx-auto mt-6 max-w-measure text-sm leading-normal text-grey-muted">
          The journal is private — only you can read it, and that includes
          us. Sign in to start one.
        </p>
        <a
          href="/signin?next=/journal"
          className="mt-7 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          Sign in to write
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-rule p-7 sm:p-10">
      {storyId && <input type="hidden" name="storyId" value={storyId} />}
      {prompt && prompt.id !== 'fallback' && (
        <input type="hidden" name="promptId" value={prompt.id} />
      )}
      <input type="hidden" name="moodId" value={mood} />

      {state.error && (
        <p
          role="alert"
          className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          aria-live="polite"
          className="mb-5 border-l-2 border-gold bg-gold-dim px-4 py-3 text-sm text-ivory"
        >
          {state.message}
        </p>
      )}

      {prompt && (
        <div className="mb-7 text-center">
          <p className="sf-eyebrow">Today&rsquo;s question</p>
          <p className="mx-auto mt-3 max-w-measure font-display text-2xl font-light italic leading-snug text-ivory">
            {prompt.body}
          </p>
        </div>
      )}

      {storyTitle && (
        <p className="mb-5 text-center text-sm text-grey-muted">
          Writing about <span className="text-ivory">{storyTitle}</span>
        </p>
      )}

      <fieldset className="mb-6">
        <legend className="sf-eyebrow mb-3 w-full text-center">
          How are you feeling?
        </legend>
        <div className="flex flex-wrap justify-center gap-2.5">
          {moods.map((m) => {
            const active = mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMood(active ? '' : m.id)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 transition-all duration-base ease-house ${
                  active
                    ? 'border-gold/50 bg-gold-dim text-ivory'
                    : 'border-rule text-grey-muted hover:border-gold/30 hover:text-ivory'
                }`}
              >
                <span aria-hidden="true">{m.emoji}</span>
                <span className="font-ui text-sm">{m.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label htmlFor="j-body" className="sr-only">
        Your reflection
      </label>
      <textarea
        id="j-body"
        name="body"
        rows={10}
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="One quiet page. No pressure."
        className="w-full resize-y border border-rule bg-ink-raised px-5 py-4 font-reading text-base leading-relaxed text-grey outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
        <label className="flex max-w-sm items-start gap-2.5 text-xs leading-normal text-grey-muted">
          <input
            type="checkbox"
            name="aiOptIn"
            className="mt-0.5 h-3.5 w-3.5 flex-none accent-[#C89528]"
          />
          <span>
            Let the companion read this entry. Off by default — your journal
            is private, including from us.
          </span>
        </label>
        <Save />
      </div>
    </form>
  );
}

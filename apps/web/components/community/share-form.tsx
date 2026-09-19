'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitPost, type CommunityResult } from '@/app/actions/community';

function Send() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gold px-7 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-soft disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Send it to the House'}
    </button>
  );
}

const field =
  'w-full border border-rule bg-ink-raised/60 px-4 py-3 font-display text-base italic text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50';

/**
 * Sharing a story or a reflection with the wall.
 *
 * Nothing here appears until a person at the House has read it, and
 * the form says so. A pen name is offered, and so is no name at all.
 */
export function ShareForm({
  displayName,
  challenge,
  prefill,
}: {
  displayName: string | null;
  challenge: { id: string; title: string; prompt: string } | null;
  prefill?: string;
}) {
  const [state, formAction] = useActionState<CommunityResult, FormData>(submitPost, {});
  const [anonymous, setAnonymous] = useState(false);
  const [body, setBody] = useState('');

  return (
    <form action={formAction} className="rounded-xl border border-rule bg-ink-raised/60 p-6 sm:p-8">
      {challenge && <input type="hidden" name="challengeId" value={challenge.id} />}

      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}

      {challenge ? (
        <div className="mb-6">
          <p className="sf-eyebrow">Responding to the challenge</p>
          <p className="mt-2 font-display text-xl text-ivory">{challenge.title}</p>
          <p className="mt-1 font-display text-base italic text-grey-muted">{challenge.prompt}</p>
        </div>
      ) : (
        <fieldset className="mb-6">
          <legend className="sf-eyebrow mb-3">What is it?</legend>
          <div className="flex flex-wrap gap-2.5">
            {[
              { value: 'reflection', label: 'A reflection' },
              { value: 'story', label: 'A story of mine' },
            ].map((k, i) => (
              <label key={k.value} className="cursor-pointer">
                <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} className="peer sr-only" />
                <span className="block border border-rule px-4 py-2 font-ui text-sm text-grey-muted transition-colors peer-checked:border-gold/50 peer-checked:text-gold hover:text-ivory">
                  {k.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {prefill && !challenge && (
        <p className="mb-4 font-display text-base italic text-grey-muted">Today’s prompt: {prefill}</p>
      )}

      <label htmlFor="c-title" className="sf-eyebrow mb-2 block">
        A title, if it has one
      </label>
      <input id="c-title" name="title" maxLength={120} placeholder="Optional" className={`${field} mb-5`} />

      <label htmlFor="c-body" className="sf-eyebrow mb-2 block">
        The words
      </label>
      <textarea
        id="c-body"
        name="body"
        required
        minLength={40}
        maxLength={4000}
        rows={10}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write it as you would tell it to one person."
        className={field}
      />
      <p className="mt-1.5 text-right font-ui text-xs tabular-nums text-grey-faint">{body.length.toLocaleString()} / 4,000</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-pen" className="sf-eyebrow mb-2 block">
            Sign it as
          </label>
          <input
            id="c-pen"
            name="penName"
            maxLength={40}
            disabled={anonymous}
            placeholder={displayName ?? 'A reader'}
            className={`${field} disabled:opacity-40`}
          />
          <p className="mt-1.5 font-ui text-xs text-grey-faint">Your name, or a pen name. Leave it empty for your name.</p>
        </div>
        <label className="flex items-start gap-3 self-end pb-6 font-ui text-sm text-grey-muted">
          <input type="checkbox" name="anonymous" value="1" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 h-3.5 w-3.5 accent-[#C89528]" />
          <span>Share it with no name at all.</span>
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
        <p className="max-w-measure font-ui text-xs leading-relaxed text-grey-muted">
          A person at the House reads everything before it appears. Nothing here is advice, and
          nothing is a substitute for a person who can help; if you are in danger, please reach one.
        </p>
        <Send />
      </div>
    </form>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { assistDraft, assistContinue, assistTitles, type AssistResult } from '@/app/actions/assist';

function Run({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-gold/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Thinking…' : label}
    </button>
  );
}

const TABS = [
  { key: 'draft', label: 'Start a draft' },
  { key: 'continue', label: 'Carry on' },
  { key: 'titles', label: 'Name it' },
] as const;

/**
 * The writing assistant.
 *
 * Collapsed by default and never on the page by accident: nobody opens
 * the Writing Room to talk to a model, and an open panel offering to
 * write for you changes what the room is for.
 *
 * Nothing here saves. What comes back appears in a box with a copy
 * button, and the writer decides what of it — if any — goes into the
 * story. Keeping the assistant and the save apart is the difference
 * between a suggestion that was wrong and a story that is wrong.
 */
export function Assistant({
  storySlug,
  shelfSlug,
  title,
  body,
}: {
  storySlug: string;
  shelfSlug?: string;
  title?: string;
  body?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('draft');
  const [copied, setCopied] = useState(false);

  const [draftState, draftAction] = useActionState<AssistResult, FormData>(assistDraft, {});
  const [contState, contAction] = useActionState<AssistResult, FormData>(assistContinue, {});
  const [titleState, titleAction] = useActionState<AssistResult, FormData>(assistTitles, {});

  const state = tab === 'draft' ? draftState : tab === 'continue' ? contState : titleState;
  const action = tab === 'draft' ? draftAction : tab === 'continue' ? contAction : titleAction;

  const field =
    'w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border border-rule px-5 py-4">
        <div>
          <h2 className="font-ui text-sm text-ivory">A hand with the writing</h2>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            Drafts only. Nothing it writes is saved or published — you decide what
            to keep.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>

      {open && (
        <div className="border-x border-b border-rule p-5">
          <nav className="mb-5 flex gap-1 border-b border-rule">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={t.key === tab ? 'true' : undefined}
                className={`-mb-px border-b-2 px-4 py-2.5 font-ui text-xs transition-colors ${
                  t.key === tab
                    ? 'border-gold text-gold'
                    : 'border-transparent text-grey-muted hover:text-ivory'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <form action={action} key={tab}>
            <input type="hidden" name="storySlug" value={storySlug} />
            <input type="hidden" name="shelfSlug" value={shelfSlug ?? ''} />

            {tab === 'draft' && (
              <>
                <input type="hidden" name="title" value={title ?? ''} />
                <label htmlFor="a-brief" className="mb-2 block font-ui text-sm text-ivory">
                  What happens in it?
                </label>
                <textarea
                  id="a-brief"
                  name="brief"
                  rows={4}
                  required
                  placeholder="A woman returns to the house she grew up in and finds the garden still keeping her mother's order…"
                  className={`${field} resize-y`}
                />
                <p className="mt-2 font-ui text-xs text-grey-muted">
                  A sentence or two is enough. It writes in the voice of the shelf
                  this story sits on.
                </p>
              </>
            )}

            {tab === 'continue' && (
              <>
                <input type="hidden" name="existing" value={body ?? ''} />
                <label htmlFor="a-note" className="mb-2 block font-ui text-sm text-ivory">
                  Where should it go? <span className="text-grey-muted">(optional)</span>
                </label>
                <input
                  id="a-note"
                  name="note"
                  placeholder="She should not forgive him yet."
                  className={field}
                />
                <p className="mt-2 font-ui text-xs text-grey-muted">
                  It reads the last few hundred words you wrote and carries on from
                  there.
                </p>
              </>
            )}

            {tab === 'titles' && (
              <>
                <input type="hidden" name="body" value={body ?? ''} />
                <p className="font-ui text-sm text-grey-muted">
                  Reads what you have written and suggests three titles, a subtitle
                  and an excerpt.
                </p>
              </>
            )}

            <div className="mt-5">
              <Run label={tab === 'titles' ? 'Suggest' : tab === 'draft' ? 'Write a draft' : 'Continue'} />
            </div>
          </form>

          {state.error && (
            <p
              role="alert"
              className="mt-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
            >
              {state.error}
            </p>
          )}

          {state.text && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="sf-eyebrow">A draft, not a decision</p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.text ?? '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      /* clipboard refused; the text is selectable below */
                    }
                  }}
                  className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/*
                A textarea, not a rendered block. It is meant to be edited
                and taken, and read-only prose invites a person to retype
                what they could have moved.
              */}
              <textarea
                readOnly
                value={state.text}
                rows={14}
                className="w-full resize-y rounded border border-rule bg-ink px-4 py-3 font-reading text-base leading-relaxed text-ivory outline-none"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

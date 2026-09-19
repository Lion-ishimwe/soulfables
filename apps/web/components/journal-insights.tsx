'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { askForInsights, type InsightsState } from '@/app/actions/insights';

/**
 * Insights, on request only.
 *
 * The journal is private, including from the House. This is the one
 * door through which a model reads it, and the reader opens it each
 * time by pressing the button. What comes back is framed as patterns
 * in their writing, is shown once, and is not kept.
 */

function Ask() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-3 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Reading…' : 'What do you notice in what I have written?'}
    </button>
  );
}

export function JournalInsights({ allowed, entries }: { allowed: boolean; entries: number }) {
  const [state, formAction] = useActionState<InsightsState, FormData>(askForInsights, {});

  return (
    <section className="mt-12 border border-rule bg-ink-raised/40 px-6 py-7 sm:px-8">
      <p className="sf-eyebrow">Patterns</p>
      <h2 className="mt-2 font-display text-2xl font-light text-ivory">A reading of your own words</h2>

      {!allowed ? (
        <>
          <p className="mt-3 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            Ask the Librarian what they notice in your recent reflections: the themes you return to,
            the feelings you name, the stories you keep coming back to. Framed as patterns in your
            writing, never as conclusions about you. It is part of Premium.
          </p>
          <Link
            href={'/membership' as Route}
            className="mt-5 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            See Premium
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            When you press this, your last {Math.min(entries, 30)} {Math.min(entries, 30) === 1 ? 'reflection is' : 'reflections are'} read
            once, by a generated voice, to answer you. Nothing is stored, and nobody at the House
            sees it. What comes back is a reading of your words, not a conclusion about you.
          </p>
          <form action={formAction} className="mt-5">
            <Ask />
          </form>
          {state.error && (
            <p role="alert" className="mt-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
              {state.error}
            </p>
          )}
          {state.locked && (
            <p className="mt-4 font-ui text-sm text-grey-muted">This is part of Premium.</p>
          )}
          {state.text && (
            <div aria-live="polite" className="mt-6 border-l-2 border-gold/50 pl-5">
              <p className="sf-eyebrow mb-3">The Librarian · generated</p>
              {state.text.split(/\n\s*\n/).map((para, i) => (
                <p key={i} className="mb-3 font-reading text-base leading-relaxed text-grey last:mb-0">
                  {para}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

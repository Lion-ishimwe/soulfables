'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';

/**
 * Ask for a story.
 *
 * "I'm feeling betrayed" in, and three things out: a short folktale
 * written for that feeling, a lesson, and a question to write to. Every
 * answer is labelled as generated, because it is; nothing here is placed
 * in the library, and nothing here is advice.
 */

type Story = { title: string; story: string; lesson: string; question: string };
type Reply =
  | { generated: true; result: Story }
  | { safety: 'crisis'; content: string }
  | { error: string };

const EXAMPLES = ['betrayed', 'lonely tonight', 'hopeful, for once', 'tired of being strong'] as const;

export function SoulStory({ allowed, signedIn }: { allowed: boolean; signedIn: boolean }) {
  const [feeling, setFeeling] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  async function askFor(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setReply(null);
    try {
      const res = await fetch('/api/soul', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeling: trimmed }),
      });
      const data = (await res.json().catch(() => ({ error: 'Something went wrong.' }))) as Reply;
      if (!res.ok && !('error' in data)) setReply({ error: 'Something went wrong reaching the Librarian.' });
      else setReply(data);
    } catch {
      setReply({ error: 'Something went wrong reaching the Librarian. Try again in a moment.' });
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <p className="font-ui text-sm text-grey-muted">
        <Link href={'/signin?next=/companion' as Route} className="text-gold hover:text-gold-soft">Sign in</Link>{' '}
        to ask for a story.
      </p>
    );
  }

  if (!allowed) {
    return (
      <div className="border border-rule bg-ink-raised/40 px-6 py-7">
        <p className="font-display text-xl text-ivory">A story written for how you feel.</p>
        <p className="mt-2 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
          Say a feeling and the Librarian writes you a short folktale for it, with a lesson and a
          question to write to. It is part of Premium.
        </p>
        <Link
          href={'/membership' as Route}
          className="mt-5 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          See Premium
        </Link>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void askFor(feeling);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="soul-feeling" className="sr-only">
          How are you feeling?
        </label>
        <input
          id="soul-feeling"
          value={feeling}
          onChange={(e) => setFeeling(e.target.value)}
          maxLength={300}
          placeholder="I’m feeling…"
          className="flex-1 border border-rule bg-ink-raised/60 px-5 py-3 font-display text-base italic text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={busy || feeling.trim().length < 2}
          className="bg-gold px-6 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Writing…' : 'Write me a story'}
        </button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-2 font-ui text-xs text-grey-faint">
        <span>For example:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setFeeling(ex);
              void askFor(ex);
            }}
            className="border border-rule px-2.5 py-1 text-grey-muted transition-colors hover:border-gold/50 hover:text-gold"
          >
            {ex}
          </button>
        ))}
      </p>

      {reply && 'error' in reply && (
        <p role="alert" className="mt-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
          {reply.error}
        </p>
      )}

      {reply && 'safety' in reply && (
        <div className="mt-6 border-l-2 border-state-danger bg-state-danger/10 px-5 py-4">
          <p className="sf-eyebrow mb-2">Please read this</p>
          {reply.content.split('\n\n').map((para, i) => (
            <p key={i} className="mb-3 font-reading text-base leading-relaxed text-grey last:mb-0">
              {para}
            </p>
          ))}
        </div>
      )}

      {reply && 'result' in reply && (
        <article aria-live="polite" className="mt-8 border border-gold/30 bg-ink-raised/40 px-6 py-8 sm:px-10 sm:py-10">
          <p className="sf-eyebrow">A story for tonight · generated</p>
          <h3 className="mt-3 font-display text-3xl font-light text-ivory">{reply.result.title}</h3>
          <div className="mt-6 space-y-4">
            {reply.result.story.split(/\n\s*\n/).map((para, i) => (
              <p key={i} className="font-reading text-lg leading-relaxed text-grey">
                {para}
              </p>
            ))}
          </div>
          {reply.result.lesson && (
            <>
              <p className="sf-eyebrow mt-10">The lesson</p>
              <p className="mt-3 font-reading text-base leading-relaxed text-grey-muted">{reply.result.lesson}</p>
            </>
          )}
          <p className="sf-eyebrow mt-8">One thing to write to</p>
          <p className="mt-3 font-display text-xl italic leading-snug text-ivory">{reply.result.question}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              href={'/journal' as Route}
              className="font-ui text-sm text-gold transition-colors hover:text-gold-soft"
            >
              Write to it in your journal →
            </Link>
            <button
              type="button"
              onClick={() => void askFor(feeling)}
              className="font-ui text-xs uppercase tracking-[0.16em] text-grey-muted transition-colors hover:text-gold"
            >
              Another story
            </button>
          </div>
          <p className="mt-8 font-ui text-xs leading-relaxed text-grey-faint">
            Written by a generated voice for you, tonight. It is not one of the House’s stories,
            which are written by people, and it is not advice.
          </p>
        </article>
      )}
    </div>
  );
}

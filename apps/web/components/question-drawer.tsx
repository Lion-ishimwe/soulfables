'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { keepReflection, type KeepResult } from '@/app/actions/questions';
import type { Card } from '@/lib/questions';

/**
 * The drawer.
 *
 * One card, face down. Tap it and it turns over to show a question. Write
 * what comes, keep it in the journal, or pull another. The drawer does
 * not repeat a card until every card has been drawn, then starts again.
 *
 * A reader who is not signed in can draw and write freely; only keeping
 * needs a name. Their words are held in the browser across the sign-in
 * and put back in front of them when they return, so nobody is asked to
 * write a thing twice.
 */

const DRAFT_KEY = 'soulfables:question-draft';
const TURN_MS = 650;

type Draft = { cardId: string; body: string };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* a browser that refuses storage simply does not carry the draft */
  }
}

function Keep({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="inline-flex items-center gap-2 bg-gold px-6 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M2 6.5l2.5 2.5L10 3.5" />
      </svg>
      {pending ? 'Keeping…' : 'Save to journal'}
    </button>
  );
}

function Star({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M9 0.5c.6 4.4 4.1 7.9 8.5 8.5-4.4.6-7.9 4.1-8.5 8.5C8.4 13.1 4.9 9.6.5 9 4.9 8.4 8.4 4.9 9 .5Z" />
    </svg>
  );
}

export function QuestionDrawer({ cards, signedIn }: { cards: Card[]; signedIn: boolean }) {
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [faceUp, setFaceUp] = useState(false);
  const [body, setBody] = useState('');
  const [kept, setKept] = useState(false);
  const drawn = useRef<Set<string>>(new Set());
  const turning = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [state, formAction] = useActionState<KeepResult, FormData>(keepReflection, {});

  /* The next card: any not yet drawn this visit, or a fresh shuffle. */
  const next = (): Card | null => {
    if (cards.length === 0) return null;
    let pool = cards.filter((c) => !drawn.current.has(c.id) && c.id !== card?.id);
    if (pool.length === 0) {
      drawn.current.clear();
      pool = cards.filter((c) => c.id !== card?.id);
      if (pool.length === 0) pool = cards;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    drawn.current.add(pick.id);
    return pick;
  };

  const draw = () => {
    const pick = next();
    if (!pick) return;
    setCard(pick);
    setBody('');
    setKept(false);
    setFaceUp(true);
  };

  const pullAnother = () => {
    if (turning.current) clearTimeout(turning.current);
    setFaceUp(false);
    // Turn face down, then change the face, then turn back — so the new
    // question is never seen mid-turn on the old card.
    turning.current = setTimeout(() => {
      draw();
    }, TURN_MS / 2);
  };

  /* Words held across a sign-in come back to the card they were written to. */
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    const found = cards.find((c) => c.id === draft.cardId);
    if (!found) {
      writeDraft(null);
      return;
    }
    drawn.current.add(found.id);
    setCard(found);
    setBody(draft.body);
    setFaceUp(true);
    if (signedIn) writeDraft(null);
  }, [cards, signedIn]);

  /* Not signed in: hold the words, go to the door, come back here. */
  useEffect(() => {
    if (!state.signIn || !card) return;
    writeDraft({ cardId: card.id, body });
    router.push('/signin?next=/questions' as Route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (state.message && !state.error) setKept(true);
  }, [state]);

  useEffect(() => () => {
    if (turning.current) clearTimeout(turning.current);
  }, []);

  if (cards.length === 0) {
    return (
      <p className="mx-auto max-w-measure text-center font-display text-xl italic text-grey-muted">
        The drawer is empty tonight. Come back when the House has written more.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-[24rem]">
      {/* ---- The card ------------------------------------------------- */}
      <div className="aspect-[5/6] w-full [perspective:1400px]">
        <div
          className={`relative h-full w-full transition-transform ease-house [transform-style:preserve-3d] ${
            faceUp ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{ transitionDuration: `${TURN_MS}ms` }}
        >
          {/* Face down. */}
          <button
            type="button"
            onClick={draw}
            aria-label="Pull a question"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 border border-gold/40 bg-ink-raised/60 text-center transition-colors duration-base hover:border-gold/70 hover:bg-ink-raised [backface-visibility:hidden]"
          >
            <Star className="text-gold" />
            <span className="font-display text-xl text-ivory">Pull a Question</span>
            <span className="font-ui text-micro uppercase tracking-[0.18em] text-grey-muted">Tap to draw</span>
          </button>

          {/* Face up. */}
          <div
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center border border-gold/40 bg-ink-raised px-7 py-8 text-center [backface-visibility:hidden] [transform:rotateY(180deg)] sm:px-9"
          >
            {card && (
              <>
                {card.glyph ? (
                  <span className="text-2xl" aria-hidden="true">
                    {card.glyph}
                  </span>
                ) : (
                  <Star className="text-gold" />
                )}
                <h2 className="mt-4 font-display text-2xl text-gold">{card.title}</h2>
                {card.feeling && (
                  <p className="mt-2 font-ui text-micro uppercase tracking-[0.22em] text-grey-muted">
                    — {card.feeling} —
                  </p>
                )}
                {card.whisper && (
                  <p className="mt-5 border-l border-gold/60 pl-3 text-left font-display text-sm italic leading-relaxed text-ivory">
                    {card.whisper}
                  </p>
                )}
                <p className="mt-6 font-ui text-micro uppercase tracking-[0.22em] text-gold">Reflection</p>
                <p className="mt-2 font-ui text-xs italic leading-relaxed text-grey-muted">
                  There is no right answer. Write only what feels true today.
                </p>
                <p className="mt-5 font-display text-xl italic leading-snug text-ivory sm:text-[1.35rem]">{card.body}</p>
                <p className="mt-6 font-ui text-xs tracking-[0.12em] text-grey">— The Librarian</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- What comes ----------------------------------------------- */}
      {card && faceUp && !kept && (
        <form action={formAction} className="mt-8">
          <input type="hidden" name="promptId" value={card.id} />
          <input type="hidden" name="title" value={card.title} />
          <label htmlFor="q-body" className="sr-only">
            Write what comes
          </label>
          <textarea
            id="q-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={20000}
            placeholder="Write what comes…"
            className="w-full resize-y border border-rule bg-ink-raised/60 px-5 py-4 font-display text-base italic text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50"
          />
          {state.error && (
            <p role="alert" className="mt-3 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
              {state.error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Keep blocked={body.trim().length === 0} />
            <button
              type="button"
              onClick={pullAnother}
              className="inline-flex items-center gap-2 border border-rule px-6 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ivory transition-colors hover:border-gold/50 hover:text-gold"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M1 3h2.5l5 6H11M1 9h2.5l5-6H11M9.5 1.5 11 3 9.5 4.5M9.5 7.5 11 9l-1.5 1.5" />
              </svg>
              Pull another
            </button>
          </div>
          {!signedIn && (
            <p className="mt-4 text-center font-ui text-xs text-grey-faint">
              Keeping it needs a name. You will be asked to sign in, and your words will be waiting.
            </p>
          )}
        </form>
      )}

      {/* ---- Kept ----------------------------------------------------- */}
      {card && kept && (
        <div className="mt-8 border border-rule bg-ink-raised/60 px-6 py-7 text-center">
          <p className="font-display text-lg text-gold">Saved to your journal.</p>
          <p className="mt-1 font-ui text-sm text-grey-muted">
            Your reflection is waiting for you{' '}
            <Link href={'/journal' as Route} className="text-gold underline-offset-4 hover:underline">
              there
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={pullAnother}
            className="mt-5 inline-flex items-center gap-2 font-ui text-xs uppercase tracking-[0.16em] text-ivory transition-colors hover:text-gold"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M1 3h2.5l5 6H11M1 9h2.5l5-6H11M9.5 1.5 11 3 9.5 4.5M9.5 7.5 11 9l-1.5 1.5" />
            </svg>
            Pull another question
          </button>
        </div>
      )}
    </div>
  );
}

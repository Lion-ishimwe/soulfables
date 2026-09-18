'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveEntry, type JournalResult } from '@/app/actions/journal';
import type { Mood, Prompt, SectionOption } from '@/lib/journal';

const WORD_LIMIT = 2000;

/** A story a reflection can be pinned to. `shelf` is the slug it lives on. */
export type StoryOption = { id: string; slug: string; title: string; shelf?: string };

function countWords(t: string) {
  return t.trim().split(/\s+/).filter(Boolean).length;
}

/* Three small marks, drawn here so the public page owes nothing to the
   admin's icon set. */
const BookMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" />
  </svg>
);
const LockMark = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="5" y="10" width="14" height="11" rx="1.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
const PenMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 20l4-1 10.5-10.5a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
  </svg>
);
const RefreshMark = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
  </svg>
);

function Save({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="flex items-center gap-2.5 rounded-lg bg-gold px-6 py-3 font-ui text-sm font-medium text-ink transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PenMark />
      {pending ? 'Keeping…' : 'Save reflection'}
    </button>
  );
}

const eyebrow = 'font-ui text-micro uppercase tracking-[0.18em] text-grey-muted';
const field =
  'w-full rounded-lg border border-rule-strong bg-ink-hover px-4 py-3 font-display text-base italic text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50 disabled:opacity-40';

/**
 * One quiet page. No pressure.
 *
 * Everything on it maps to something the House already keeps. The six
 * feelings are the moods table. "Connect to a story" lists what is on the
 * reader's own shelf — read, reading, or saved — and never the whole
 * library, because a reflection is about something you have been inside.
 * "Where in the story" is the story's sections, shown only for stories
 * that have them. "A line you want to remember" is a saved passage, kept
 * against the story the way the reader's library keeps them, which is why
 * it needs a story chosen first.
 *
 * The AI consent control stays. It is off unless deliberately turned on,
 * it is per entry rather than per account, and its label says what
 * actually happens rather than asking for permission in the abstract.
 */
export function JournalComposer({
  moods,
  prompt,
  anotherHref,
  stories,
  library,
  shelves,
  sections,
  signedIn,
  initialStoryId = '',
}: {
  moods: Mood[];
  prompt: Prompt | null;
  anotherHref: string;
  /** The reader's own shelf: reading, finished, saved. */
  stories: StoryOption[];
  /** Everything published, with shelves — for the feeling's shelf. */
  library: StoryOption[];
  shelves: { slug: string; label: string }[];
  sections: SectionOption[];
  signedIn: boolean;
  /** Arrived from a story's page: that story, already chosen. */
  initialStoryId?: string;
}) {
  const [state, formAction] = useActionState<JournalResult, FormData>(saveEntry, {});
  const [mood, setMood] = useState('');
  const [body, setBody] = useState('');
  const [storyId, setStoryId] = useState(initialStoryId);
  const [sectionId, setSectionId] = useState('');
  const [quote, setQuote] = useState('');

  const words = useMemo(() => countWords(body), [body]);
  const over = words > WORD_LIMIT;
  const storySections = useMemo(
    () => sections.filter((s) => s.storyId === storyId),
    [sections, storyId],
  );

  /*
   * A feeling is a doorway to a shelf — that is what the moods table
   * says, and what the Library is browsed by. So choosing Grieving also
   * offers the Grief shelf's stories, in their own group beneath the
   * reader's own, without repeating anything already on their shelf.
   */
  /*
   * Connecting a story is not a half-measure.
   *
   * Both fields under it used to say "(optional)", so a story could be
   * attached to a reflection with nothing said about where in it, or
   * which line was worth keeping — the two things that make the
   * connection worth having. They are required now, and the button waits
   * for them rather than failing after the fact.
   */
  const missingPlace = Boolean(storyId) && storySections.length > 0 && sectionId === '';
  const missingQuote = Boolean(storyId) && quote.trim().length === 0;
  const storyIncomplete = missingPlace || missingQuote;

  const moodShelf = moods.find((m) => m.id === mood)?.shelfSlug ?? null;
  const shelfLabel = shelves.find((s) => s.slug === moodShelf)?.label ?? null;
  const mine = useMemo(() => new Set(stories.map((s) => s.id)), [stories]);
  const fromShelf = useMemo(
    () => (moodShelf ? library.filter((s) => s.shelf === moodShelf && !mine.has(s.id)) : []),
    [library, moodShelf, mine],
  );

  /* Changing the feeling can remove the chosen story from the list. A
     controlled select whose value is no longer an option goes blank
     while the state still holds the id, so the choice is cleared. */
  const chooseMood = (next: string) => {
    setMood(next);
    if (!storyId || mine.has(storyId)) return;
    const nextShelf = moods.find((m) => m.id === next)?.shelfSlug ?? null;
    const stillOffered = library.some((s) => s.id === storyId && s.shelf === nextShelf);
    if (!stillOffered) {
      setStoryId('');
      setSectionId('');
    }
  };

  if (!signedIn) {
    return (
      <div className="rounded-xl border border-rule bg-ink-raised/60 p-8 text-center sm:p-10">
        <p className={eyebrow}>Today&rsquo;s reflection</p>
        {prompt && (
          <p className="mx-auto mt-4 max-w-measure font-display text-2xl font-light italic leading-snug text-ivory sm:text-3xl">
            {prompt.body}
          </p>
        )}
        <p className="mx-auto mt-6 max-w-measure text-sm leading-normal text-grey-muted">
          The journal is private — only you can read it, and that includes
          us. Sign in to start one.
        </p>
        <a
          href="/signin?next=/journal"
          className="mt-7 inline-block rounded-lg bg-gold px-7 py-3 font-ui text-sm font-medium text-ink transition-colors hover:bg-gold-soft"
        >
          Sign in to write
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-rule bg-ink-raised/60 p-6 sm:p-8">
      {prompt && prompt.id !== 'fallback' && (
        <input type="hidden" name="promptId" value={prompt.id} />
      )}
      <input type="hidden" name="moodId" value={mood} />
      <input type="hidden" name="storyId" value={storyId} />
      <input type="hidden" name="sectionId" value={storySections.length ? sectionId : ''} />
      {/* Whether this story had places to choose between, so the server
          can hold the same rule the composer shows. */}
      <input type="hidden" name="hasSections" value={storySections.length ? '1' : ''} />

      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mb-5 border-l-2 border-gold bg-gold-dim px-4 py-3 text-sm text-ivory">
          {state.message}
        </p>
      )}

      {/* ---- The question --------------------------------------------- */}
      {prompt && (
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={eyebrow}>Today&rsquo;s reflection</p>
            <p className="mt-3 max-w-measure font-display text-2xl font-light italic leading-snug text-ivory sm:text-3xl">
              {prompt.body}
            </p>
          </div>
          <Link
            href={anotherHref as Route}
            className="flex shrink-0 items-center gap-2 font-ui text-sm text-gold transition-colors hover:text-gold-soft"
          >
            <RefreshMark />
            Another question
          </Link>
        </div>
      )}

      {/* ---- The feeling ---------------------------------------------- */}
      <fieldset className="mb-7">
        <legend className={`${eyebrow} mb-3`}>How are you feeling?</legend>
        <div className="flex flex-wrap gap-2.5">
          {moods.map((m) => {
            const active = mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => chooseMood(active ? '' : m.id)}
                aria-pressed={active}
                className={`flex items-center gap-2.5 rounded-full border px-5 py-2.5 transition-all duration-base ease-house ${
                  active
                    ? 'border-gold bg-gold-dim text-ivory'
                    : 'border-rule text-grey hover:border-gold/40 hover:text-ivory'
                }`}
              >
                <span aria-hidden="true">{m.emoji}</span>
                <span className="font-ui text-sm">{m.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* ---- The page ------------------------------------------------- */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
        <label htmlFor="j-body" className={eyebrow}>Your thoughts</label>
        <span className="font-display text-sm italic text-grey-muted">One quiet page. No pressure.</span>
      </div>
      <div className="relative">
        <textarea
          id="j-body"
          name="body"
          rows={7}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write freely…"
          aria-describedby="j-count"
          className={`w-full resize-y rounded-lg border bg-ink-hover px-5 py-4 pb-9 font-display text-lg italic leading-relaxed text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50 ${
            over ? 'border-state-danger/60' : 'border-rule-strong'
          }`}
        />
        <span
          id="j-count"
          className={`pointer-events-none absolute bottom-3.5 right-4 font-ui text-xs tabular-nums ${
            over ? 'text-state-danger' : 'text-grey-faint'
          }`}
        >
          {words.toLocaleString()} / {WORD_LIMIT.toLocaleString()} words
        </span>
      </div>

      <hr className="my-7 border-rule" />

      {/* ---- The story it belongs to ---------------------------------- */}
      <label htmlFor="j-story" className={`${eyebrow} mb-2 block`}>
        Connect to a story
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-grey-muted">
          <BookMark />
        </span>
        <select
          id="j-story"
          value={storyId}
          onChange={(e) => {
            setStoryId(e.target.value);
            setSectionId('');
            setQuote('');
          }}
          className={`${field} appearance-none pl-11 pr-10`}
        >
          <option value="" className="bg-ink not-italic">
            {stories.length || fromShelf.length
              ? 'Select a story'
              : 'Nothing on your shelf yet — choose a feeling, or read something first'}
          </option>
          {stories.length > 0 && (
            <optgroup label="From your shelf" className="bg-ink not-italic">
              {stories.map((s) => (
                <option key={s.id} value={s.id} className="bg-ink not-italic">
                  {s.title}
                </option>
              ))}
            </optgroup>
          )}
          {fromShelf.length > 0 && (
            <optgroup label={`On the ${shelfLabel ?? ''} shelf`} className="bg-ink not-italic">
              {fromShelf.map((s) => (
                <option key={s.id} value={s.id} className="bg-ink not-italic">
                  {s.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-grey-muted">
          ⌄
        </span>
      </div>
      {moodShelf && shelfLabel && (
        <p className="mt-1.5 font-ui text-micro text-grey-faint">
          {fromShelf.length > 0
            ? `Also offering the ${fromShelf.length} ${fromShelf.length === 1 ? 'story' : 'stories'} on the ${shelfLabel} shelf, because that is where this feeling lives.`
            : `Everything on the ${shelfLabel} shelf is already on yours.`}
        </p>
      )}

      <div className={`mt-5 grid gap-5 ${storySections.length ? 'sm:grid-cols-2' : ''}`}>
        {storySections.length > 0 && (
          <div>
            <label htmlFor="j-section" className={`${eyebrow} mb-2 block`}>
              Where in the story
            </label>
            {/*
              "Anywhere in it" is still an answer, but it is now one the
              reader gives rather than one the form assumes. Connecting a
              story is a promise to say where in it this belongs.
            */}
            <select
              id="j-section"
              required
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={`${field} appearance-none pr-10`}
            >
              <option value="" disabled className="bg-ink not-italic">Choose a place in it</option>
              <option value="anywhere" className="bg-ink not-italic">Anywhere in it</option>
              {storySections.map((s) => (
                <option key={s.id} value={s.id} className="bg-ink not-italic">
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="j-quote" className={`${eyebrow} mb-2 block`}>
            A line you want to remember
          </label>
          <input
            id="j-quote"
            name="quote"
            required={Boolean(storyId)}
            disabled={!storyId}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={2000}
            placeholder={storyId ? 'A quote, a sentence, or a thought…' : 'Choose a story first'}
            className={field}
          />
          {storyId && (
            <p className="mt-1.5 font-ui text-micro text-grey-faint">
              Kept as a saved passage in your library, against this story.
            </p>
          )}
        </div>
      </div>

      {/* ---- Keeping it ----------------------------------------------- */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          {/*
            There used to be a checkbox here offering to let the Librarian
            read the entry. The Librarian is rule-based and reads nothing,
            so the switch did nothing — and a switch that does nothing is
            a promise the House does not keep. It returns when there is a
            Librarian that reads. Until then the column stays false.
          */}
          <p className="flex items-center gap-2 font-ui text-xs text-grey-muted">
            <LockMark />
            Your reflections are private to you — and that includes from us.
          </p>
          {storyIncomplete && (
            <p className="mt-1.5 font-ui text-micro text-grey-faint">
              {missingPlace
                ? 'Choose where in the story this belongs, and the line you want to remember.'
                : 'Add the line you want to remember, or disconnect the story.'}
            </p>
          )}
        </div>
        <Save blocked={over || words === 0 || storyIncomplete} />
      </div>
    </form>
  );
}

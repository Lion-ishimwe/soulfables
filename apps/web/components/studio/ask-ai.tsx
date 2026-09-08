'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * Ask AI.
 *
 * A button, and hanging from it a card: the conversation so far above,
 * the place to type below. It opens where the button is — under it,
 * aligned to its right edge — so it reads as the button's own, and on a
 * phone it takes the width of the screen beneath the header instead. A
 * writer asking "does this opening work?" wants the opening in view
 * while the answer comes, so the card does not take the page.
 *
 * The card is rendered at the end of the document and placed by
 * measuring the button, not nested under it. Nested, a fixed card inside
 * a header with a backdrop blur is positioned against the header rather
 * than the screen — the blur makes the header a containing block — and
 * lands a hundred pixels adrift. Measured, it lands under the button.
 *
 * The conversation lives in this component and nowhere else. Close the
 * panel and it stays; leave the page and it is gone. Nothing said here
 * is kept, and nothing said here changes a story: the assistant's other
 * jobs produce drafts to be copied, and this one produces answers to be
 * read.
 */
export function AskAI({
  storySlug,
  storyTitle,
  compact = false,
}: {
  storySlug?: string;
  storyTitle?: string;
  /** In a header: smaller, and quieter until hovered. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * Where the card goes: just under the button, its right edge on the
   * button's right edge. On a phone there is no room to hang a card from
   * anything, so it becomes a sheet across the screen at the same height.
   * Re-measured on resize and scroll, since the header the button sits in
   * may or may not stay put.
   */
  const [place, setPlace] = useState<{ top: number; right: number; sheet: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPlace({
        top: Math.round(rect.bottom + 10),
        // clientWidth, not innerWidth: the latter counts the scrollbar,
        // and a fixed right edge is measured from inside it.
        right: Math.round(document.documentElement.clientWidth - rect.right),
        sheet: window.innerWidth < 640,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, turns, thinking]);

  // Escape closes it, as it closes everything else in the House; so does
  // a click anywhere else, the way the account menu closes. The
  // conversation is kept either way — closing is not clearing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setError(null);
    setThinking(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, storySlug }),
      });
      const data = (await res.json().catch(() => ({}))) as { content?: string; error?: string };

      if (!res.ok || !data.content) {
        setError(data.error ?? 'Something went wrong reaching the assistant. Try again in a moment.');
        return;
      }
      setTurns([...next, { role: 'assistant', content: data.content }]);
    } catch {
      setError('Could not reach the assistant. Check the connection and try again.');
    } finally {
      setThinking(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="ask-ai-panel"
        className={
          compact
            ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-gold/40 px-3 py-1.5 font-ui text-xs text-gold transition-all hover:bg-gold hover:text-ink'
            : 'inline-flex items-center gap-2 border border-gold/50 px-4 py-2 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink'
        }
      >
        <span aria-hidden="true">✦</span> Ask AI
      </button>

      {open && place && createPortal(
        <div
          id="ask-ai-panel"
          ref={panelRef}
          role="dialog"
          aria-label={storyTitle ? `Ask AI about ${storyTitle}` : 'Ask AI'}
          className="fixed z-50 flex flex-col rounded-md border border-rule-strong bg-ink shadow-2xl shadow-black/70"
          style={{
            top: place.top,
            right: place.sheet ? 12 : place.right,
            left: place.sheet ? 12 : 'auto',
            width: place.sheet ? 'auto' : 'min(26rem, calc(100vw - 1.5rem))',
            maxHeight: `min(34rem, calc(100dvh - ${place.top + 12}px))`,
          }}
        >
          {/* The notch that ties the card to its button. */}
          {!place.sheet && (
            <span
              aria-hidden="true"
              className="absolute -top-1.5 right-7 h-3 w-3 rotate-45 border-l border-t border-rule-strong bg-ink"
            />
          )}

          <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
            <div className="min-w-0">
              <p className="font-ui text-sm text-ivory">
                <span className="text-gold" aria-hidden="true">✦</span> Ask AI
              </p>
              <p className="mt-1 truncate font-ui text-xs text-grey-muted">
                {storyTitle
                  ? `About “${storyTitle}”`
                  : storySlug
                    ? 'About the story open on your desk'
                    : 'About whatever you are working on'}
                {' · '}nothing here is saved
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              {turns.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTurns([]);
                    setError(null);
                  }}
                  className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
              >
                Close
              </button>
            </div>
          </header>

          <div className="min-h-[10rem] flex-1 overflow-y-auto px-5 py-4">
            {turns.length === 0 && !thinking && (
              <p className="font-reading text-sm italic leading-relaxed text-grey-muted">
                Ask about an opening, a title, where a scene should go, or what a
                shelf wants from a story. It answers in the House&rsquo;s voice and
                knows {storySlug ? 'this story' : 'the library'}.
              </p>
            )}

            <ul className="space-y-4">
              {turns.map((t, i) => (
                <li key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed ${
                      t.role === 'user'
                        ? 'border border-gold/30 bg-gold-dim font-ui text-ivory'
                        : 'border border-rule bg-ink-raised font-reading text-grey'
                    }`}
                  >
                    {t.content}
                  </div>
                </li>
              ))}
              {thinking && (
                <li className="flex justify-start">
                  <div className="border border-rule bg-ink-raised px-4 py-3 font-ui text-xs text-grey-muted">
                    Thinking…
                  </div>
                </li>
              )}
            </ul>

            {error && (
              <p role="alert" className="mt-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="border-t border-rule p-4"
          >
            <label htmlFor="ask-ai-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="ask-ai-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              maxLength={4000}
              placeholder={storySlug ? 'Is the opening earning its length?' : 'What does the Grief shelf want from a story?'}
              className="w-full resize-none border border-rule-strong bg-ink-hover px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-muted focus:border-gold/50"
            />
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="font-ui text-micro text-grey-faint">Enter to send · Shift+Enter for a new line</span>
              <button
                type="submit"
                disabled={thinking || !input.trim()}
                className="border border-gold/60 px-5 py-2 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink disabled:opacity-50"
              >
                {thinking ? 'Thinking…' : 'Send'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}

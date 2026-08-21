'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  toggleSaved,
  recordProgress,
  createBookmark,
  keepPassage,
} from '@/app/actions/reading';

/**
 * Everything a reader can do to a story while reading it.
 *
 * Three actions, deliberately different in weight:
 *
 *   Keep      — the whole story. One click, optimistic.
 *   Bookmark  — a place in it, optionally with a note.
 *   Highlight — a sentence, taken from the selection.
 *
 * The highlight affordance appears only when text is actually selected
 * inside the prose, and disappears the moment it is not. Nothing floats
 * over the story otherwise: the brief asks for a distraction-free reader,
 * and a permanent toolbar is a distraction that has been normalised.
 */

const PROGRESS_INTERVAL_MS = 10_000;
const COMPLETE_AT = 0.92;

type Section = { slug: string; title: string };

export function ReaderToolkit({
  storyId,
  storySlug,
  sections,
}: {
  storyId: string;
  storySlug: string;
  sections: Section[];
}) {
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  const [bookmarking, setBookmarking] = useState(false);
  const [note, setNote] = useState('');
  const [sectionSlug, setSectionSlug] = useState('');
  const [flash, setFlash] = useState<string | null>(null);

  const [selection, setSelection] = useState<string | null>(null);

  const lastSent = useRef(0);
  const pathname = usePathname();

  // The server knows about both real sessions and demo ones, and whether
  // this story is already kept — the page is static, so it cannot.
  // Keyed on the pathname too, so signing in mid-visit is picked up
  // rather than leaving the controls convinced you are a stranger.
  useEffect(() => {
    let active = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { signedIn: boolean; savedSlugs: string[] }) => {
        if (!active) return;
        setSignedIn(me.signedIn);
        setSaved(me.savedSlugs.includes(storySlug));
      })
      .catch(() => active && setSignedIn(false));
    return () => {
      active = false;
    };
  }, [storySlug, pathname]);

  const announce = useCallback((message: string) => {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 3000);
  }, []);

  // --- Reading progress ------------------------------------------------
  useEffect(() => {
    if (!signedIn) return;

    function percentRead(): number {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return 1;
      return Math.min(1, Math.max(0, window.scrollY / scrollable));
    }

    function maybeSend(force = false) {
      const now = Date.now();
      if (!force && now - lastSent.current < PROGRESS_INTERVAL_MS) return;
      lastSent.current = now;
      const p = percentRead();
      void recordProgress({ storyId, percent: p, completed: p >= COMPLETE_AT });
    }

    const onScroll = () => maybeSend();
    const onLeave = () => maybeSend(true);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onLeave);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onLeave);
      maybeSend(true);
    };
  }, [signedIn, storyId]);

  // --- Selection, for highlighting -------------------------------------
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';

      if (!text || text.length < 4) {
        setSelection(null);
        return;
      }

      // Only offer to keep text that is actually part of the story.
      const anchor = sel?.anchorNode;
      const inProse =
        anchor instanceof Node &&
        (anchor.parentElement?.closest('.sf-prose') ?? null) !== null;

      setSelection(inProse ? text.slice(0, 2000) : null);
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  function requireAccount(): boolean {
    if (signedIn) return true;
    window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
    return false;
  }

  function onKeep() {
    if (!requireAccount()) return;
    setSaved((v) => !v);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('storyId', storyId);
      const result = await toggleSaved(fd);
      if (result.error) setSaved((v) => !v);
      else if (typeof result.saved === 'boolean') {
        setSaved(result.saved);
        announce(result.saved ? 'Kept on your shelf.' : 'Removed from your shelf.');
      }
    });
  }

  function onBookmark() {
    if (!requireAccount()) return;
    startTransition(async () => {
      const section = sections.find((s) => s.slug === sectionSlug) ?? null;
      const result = await createBookmark({
        storyId,
        storySlug,
        sectionSlug: section?.slug ?? null,
        sectionTitle: section?.title ?? null,
        note: note || null,
      });
      if (result.ok) {
        setBookmarking(false);
        setNote('');
        setSectionSlug('');
        announce('Bookmarked. It is in your library.');
      }
    });
  }

  function onKeepPassage() {
    if (!selection) return;
    if (!requireAccount()) return;
    const quote = selection;
    startTransition(async () => {
      const result = await keepPassage({ storyId, storySlug, quote });
      if (result.ok) {
        window.getSelection()?.removeAllRanges();
        setSelection(null);
        announce('Passage kept.');
      }
    });
  }

  return (
    <>
      {/* Appears only while something is selected. */}
      {selection && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/30 bg-ink/95 backdrop-blur">
          <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="min-w-0 flex-1 truncate font-reading text-sm italic text-grey">
              “{selection}”
            </p>
            <button
              type="button"
              onClick={onKeepPassage}
              disabled={pending}
              className="flex-none border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
            >
              Keep this passage
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onKeep}
          disabled={pending}
          aria-pressed={saved}
          className={`border px-7 py-3.5 font-ui text-xs uppercase tracking-[0.18em] transition-all duration-base ease-house disabled:opacity-60 ${
            saved
              ? 'border-gold/50 bg-gold-dim text-gold'
              : 'border-rule text-grey-muted hover:border-ivory/30 hover:text-ivory'
          }`}
        >
          {saved ? '✦ Kept' : 'Keep this story'}
        </button>

        <button
          type="button"
          onClick={() => (bookmarking ? setBookmarking(false) : requireAccount() && setBookmarking(true))}
          aria-expanded={bookmarking}
          className="border border-rule px-7 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-all duration-base ease-house hover:border-ivory/30 hover:text-ivory"
        >
          {bookmarking ? 'Cancel' : 'Bookmark a place'}
        </button>
      </div>

      {flash && (
        <p aria-live="polite" className="mt-4 text-sm text-gold">
          {flash}
        </p>
      )}

      {bookmarking && (
        <div className="mx-auto mt-6 max-w-measure border border-rule bg-ink-raised p-6 text-left">
          <p className="sf-eyebrow mb-4">Bookmark</p>

          {sections.length > 0 && (
            <div className="mb-4">
              <label htmlFor="bm-section" className="sf-eyebrow mb-2 block">
                Where
              </label>
              <select
                id="bm-section"
                value={sectionSlug}
                onChange={(e) => setSectionSlug(e.target.value)}
                className="w-full border border-rule bg-ink px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
              >
                <option value="">The story as a whole</option>
                {sections.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label htmlFor="bm-note" className="sf-eyebrow mb-2 block">
            Note
          </label>
          <input
            id="bm-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="why you are marking it"
            className="w-full border border-rule bg-ink px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
          />

          <button
            type="button"
            onClick={onBookmark}
            disabled={pending}
            className="mt-5 w-full border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save bookmark'}
          </button>
        </div>
      )}
    </>
  );
}

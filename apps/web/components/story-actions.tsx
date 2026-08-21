'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toggleSaved, recordProgress } from '@/app/actions/reading';

/**
 * Keep, and remember where I was.
 *
 * Progress is recorded on a trailing throttle while the reader scrolls,
 * and once more on the way out. Two things it deliberately does not do:
 * write on every scroll event (which would be a request per frame), and
 * complain when nobody is signed in (reading works fine without an
 * account; it just is not remembered).
 */

const PROGRESS_INTERVAL_MS = 10_000;

export function StoryActions({
  storyId,
  storySlug,
}: {
  storyId: string;
  storySlug: string;
}) {
  const [saved, setSaved] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  const lastSent = useRef(0);
  const lastPercent = useRef(0);

  // Ask the server rather than inferring from configuration. It knows
  // about both real sessions and demo ones, and it also tells us whether
  // this story is already kept — which the page itself cannot, because
  // it is statically generated.
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
  }, [storySlug]);

  useEffect(() => {
    if (!signedIn) return;

    function percentRead(): number {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return 1;
      return Math.min(1, Math.max(0, window.scrollY / scrollable));
    }

    function maybeSend(force = false) {
      const p = percentRead();
      lastPercent.current = p;

      const now = Date.now();
      if (!force && now - lastSent.current < PROGRESS_INTERVAL_MS) return;
      lastSent.current = now;

      // Fire and forget. A dropped progress ping is not worth a retry.
      void recordProgress({
        storyId,
        percent: p,
        // Anything past 92% is a finished story: almost nobody scrolls
        // through the footer, and a story that never registers as read
        // is worse than one that registers slightly early.
        completed: p >= 0.92,
      });
    }

    const onScroll = () => maybeSend();
    const onLeave = () => maybeSend(true);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onLeave();
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onLeave);
      maybeSend(true);
    };
  }, [signedIn, storyId]);

  function onToggle() {
    if (!signedIn) {
      window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    // Optimistic: keeping a story should feel instant.
    setSaved((v) => !v);

    startTransition(async () => {
      const fd = new FormData();
      fd.set('storyId', storyId);
      const result = await toggleSaved(fd);
      if (result.error) setSaved((v) => !v); // put it back
      else if (typeof result.saved === 'boolean') setSaved(result.saved);
    });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={saved}
      className={`border px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] transition-all duration-base ease-house disabled:opacity-60 ${
        saved
          ? 'border-gold/50 bg-gold-dim text-gold'
          : 'border-rule text-grey-muted hover:border-ivory/30 hover:text-ivory'
      }`}
    >
      {saved ? '✦ Kept' : 'Keep this story'}
    </button>
  );
}

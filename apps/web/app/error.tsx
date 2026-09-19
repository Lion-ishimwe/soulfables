'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/components/report-client-error';

/*
 * What a reader sees when a page breaks in the browser.
 *
 * Without this file Next shows its own grey "Application error: a
 * client-side exception has occurred" — a sentence with no way out. The
 * commonest cause here is not a bug at all: a tab left open across a
 * deploy submits a form whose server action the new build no longer
 * knows, or asks for a script the new build no longer serves. A fresh
 * load fixes both, so the page reloads itself once, quietly, and only
 * speaks if the trouble is still there afterwards.
 *
 * Every error is recorded, before the reload, so the Report page in the
 * admin shows browser failures next to the server's own.
 */

const RELOAD_KEY = 'soulfables:reloaded';
const RELOAD_WINDOW_MS = 60_000;

function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    return Date.now() - at < RELOAD_WINDOW_MS;
  } catch {
    return true; // no storage: do not risk a loop
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* nothing to remember with */
  }
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const reload = !reloadedRecently();
    reportClientError(error, reload);
    if (reload) {
      markReloaded();
      window.location.reload();
      return;
    }
    setSettled(true);
  }, [error]);

  // While the reload is on its way, show nothing rather than a flash of apology.
  if (!settled) return null;

  return (
    <section className="mx-auto max-w-content px-5 py-32 text-center sm:px-8 sm:py-44">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-6">A STUMBLE</p>
      <h1 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
        Something in this page did not open.
      </h1>
      <p className="mx-auto mt-6 max-w-measure text-base leading-normal text-grey-muted">
        The House has made a note of it. Try once more; if it still will not open, the library is
        always there.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => {
            markReloaded();
            reset();
          }}
          className="border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
        >
          Try again
        </button>
        <Link
          href="/library"
          className="border-b border-gold/40 pb-1 font-ui text-sm text-gold transition-colors duration-base ease-house hover:border-gold hover:text-gold-soft"
        >
          Browse the library
        </Link>
      </div>
    </section>
  );
}

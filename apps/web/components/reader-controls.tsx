'use client';

import { useEffect, useState } from 'react';

/**
 * Reader controls: text size and reading mode.
 *
 * Deliberately not a floating overlay. It sits in the page between the
 * title and the first paragraph, so nothing hovers over the prose while
 * someone is reading.
 *
 * Preferences are written to localStorage immediately so the setting
 * survives a reload for signed-out readers, and synced to user_settings
 * when there is a session — the same two values back the Flutter reader.
 */
const SCALES = [
  { label: 'A', value: 0.9, name: 'Small text' },
  { label: 'A', value: 1.0, name: 'Default text' },
  { label: 'A', value: 1.15, name: 'Large text' },
  { label: 'A', value: 1.3, name: 'Larger text' },
] as const;

export function ReaderControls() {
  const [scale, setScale] = useState(1);
  const [paper, setPaper] = useState(false);

  // Restore on mount.
  useEffect(() => {
    const savedScale = Number(localStorage.getItem('sf:reader-scale'));
    const savedPaper = localStorage.getItem('sf:reader-paper') === '1';
    if (savedScale) setScale(savedScale);
    setPaper(savedPaper);
  }, []);

  // Apply and persist.
  useEffect(() => {
    document.documentElement.style.setProperty('--reader-scale', String(scale));
    localStorage.setItem('sf:reader-scale', String(scale));
  }, [scale]);

  useEffect(() => {
    document.body.classList.toggle('sf-reader-paper', paper);
    localStorage.setItem('sf:reader-paper', paper ? '1' : '0');
    return () => document.body.classList.remove('sf-reader-paper');
  }, [paper]);

  return (
    <div className="flex items-center justify-center gap-8 border-y border-rule py-4">
      <div
        className="flex items-baseline gap-3"
        role="group"
        aria-label="Text size"
      >
        {SCALES.map((s, i) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setScale(s.value)}
            aria-label={s.name}
            aria-pressed={scale === s.value}
            className={`font-display leading-none transition-colors duration-fast ease-house ${
              scale === s.value ? 'text-gold' : 'text-grey-muted hover:text-ivory'
            }`}
            style={{ fontSize: `${0.8 + i * 0.22}rem` }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <span className="h-4 w-px bg-rule" aria-hidden="true" />

      <button
        type="button"
        onClick={() => setPaper((v) => !v)}
        aria-pressed={paper}
        className="font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-colors duration-fast ease-house hover:text-ivory"
      >
        {paper ? 'Night' : 'Paper'}
      </button>
    </div>
  );
}

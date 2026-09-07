'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Asking before something irreversible happens.
 *
 * This replaces window.confirm(), which was doing the job badly in three
 * ways. It renders in the browser's chrome rather than the House's, so
 * the most consequential moment in the admin was also the only one that
 * looked like somebody else's software. It puts OK and Cancel side by
 * side with OK focused, so Enter deletes. And it cannot tell "delete this
 * story" from "delete this shelf and orphan the eleven stories on it" —
 * every question gets the same two buttons and the same one click.
 *
 * Built on <dialog> rather than a div with a high z-index. showModal()
 * gives a focus trap, Escape, inertness for everything behind it, and a
 * real ::backdrop — all things a hand-rolled modal gets subtly wrong, and
 * gets wrong in ways that only show up for somebody navigating by
 * keyboard or screen reader.
 *
 * Where `word` is given, the button stays dead until it has been typed.
 * The friction is the point: it converts a reflex into a decision, and it
 * makes deleting the wrong row take a deliberate act rather than a
 * mis-aimed click.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  word,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  /** Type this to enable the button. Omit for a plain confirmation. */
  word?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const inputId = useId();

  const ready = !word || typed.trim().toLowerCase() === word.toLowerCase();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open && !el.open) {
      setTyped('');
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      /*
       * Escape fires `cancel`, and the browser closes the dialog itself
       * afterwards. Telling the parent here keeps its `open` in step;
       * without this the state says open, the element is closed, and the
       * dialog cannot be opened a second time.
       */
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      /* A click on the backdrop lands on the dialog element itself. */
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      aria-labelledby={`${inputId}-title`}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-rule bg-ink p-0 text-ivory shadow-lift backdrop:bg-black/70 backdrop:backdrop-blur-[2px]"
    >
      <form method="dialog" onSubmit={(e) => e.preventDefault()} className="p-6">
        <h2
          id={`${inputId}-title`}
          className="font-display text-2xl font-light leading-snug text-ivory"
        >
          {title}
        </h2>

        {body && (
          <p className="mt-3 text-sm leading-relaxed text-grey-muted">{body}</p>
        )}

        {word && (
          <div className="mt-5">
            <label
              htmlFor={inputId}
              className="mb-2 block font-ui text-xs text-grey-muted"
            >
              Type <span className="font-mono text-state-danger">{word}</span> to
              confirm
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && ready) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded border border-rule bg-ink-raised px-3.5 py-2.5 font-mono text-sm text-ivory outline-none transition-colors focus:border-state-danger/60"
            />
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {/*
            Cancel first in the DOM, and focused when nothing has to be
            typed. The safe choice should be the one a hurried Enter
            reaches — confirm() got this backwards.
          */}
          <button
            type="button"
            onClick={onCancel}
            autoFocus={!word}
            className="rounded border border-rule px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:border-rule-strong hover:text-ivory"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready}
            className="rounded border border-state-danger/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-state-danger transition-colors hover:bg-state-danger hover:text-ink disabled:cursor-not-allowed disabled:border-rule disabled:text-grey-faint disabled:hover:bg-transparent"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

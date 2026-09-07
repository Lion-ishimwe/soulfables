'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from './confirm-dialog';

/**
 * The ⋮ menu.
 *
 * One of these sits on every row that can be changed or removed, so
 * destructive actions live in a consistent place rather than as a naked
 * "Remove" link sitting next to the thing it deletes.
 *
 * Two behaviours worth naming:
 *
 *   Destructive items ask first, in the House's own dialogue rather than
 *   the browser's. Deletions ask harder: `confirmWord` keeps the button
 *   dead until the word is typed, so removing a shelf that eleven stories
 *   stand on cannot happen by mis-aimed click.
 *
 *   The menu closes on Escape, on an outside click, and on choosing
 *   something. A menu you cannot dismiss is its own small trap.
 */

export type KebabItem =
  | { kind: 'link'; label: string; href: Route }
  | {
      kind: 'action';
      label: string;
      action: (formData: FormData) => void | Promise<void>;
      fields?: Record<string, string>;
      danger?: boolean;
      /** Heading of the dialogue. Presence implies destructive. */
      confirm?: string;
      /** Sentence under the heading: what this costs, in plain terms. */
      confirmBody?: string;
      /** Require this typed before the button works. Deletions use it. */
      confirmWord?: string;
      /** Verb on the button. Defaults to the menu item's own label. */
      confirmLabel?: string;
    };

type ActionItem = Extract<KebabItem, { kind: 'action' }>;

export function KebabMenu({
  items,
  label = 'Actions',
}: {
  items: KebabItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<ActionItem | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /*
   * The guarded action gets its own form, rendered outside the menu.
   *
   * It cannot live inside the menu: asking the question closes the menu,
   * which unmounts everything in it, and a form that no longer exists
   * cannot be submitted. So the item that is being confirmed is copied
   * out here for as long as the dialogue is up.
   */
  const armedRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const itemClass = (danger?: boolean) =>
    `block w-full px-4 py-2.5 text-left font-ui text-sm transition-colors hover:bg-ink-raised ${
      danger ? 'text-state-danger hover:text-state-danger' : 'text-grey hover:text-ivory'
    }`;

  return (
    <div ref={wrapRef} className="relative flex justify-end">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-full text-grey-muted transition-colors hover:bg-ink-raised hover:text-ivory"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-48 border border-rule bg-ink shadow-lift"
        >
          {items.map((item, i) =>
            item.kind === 'link' ? (
              <Link
                key={i}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-left font-ui text-sm text-grey transition-colors hover:bg-ink-raised hover:text-ivory"
              >
                {item.label}
              </Link>
            ) : item.confirm ? (
              // Guarded: opens the question, submits nothing yet.
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setAsking(item);
                }}
                className={itemClass(item.danger)}
              >
                {item.label}
              </button>
            ) : (
              <form key={i} action={item.action} onSubmit={() => setOpen(false)}>
                {Object.entries(item.fields ?? {}).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <button type="submit" role="menuitem" className={itemClass(item.danger)}>
                  {item.label}
                </button>
              </form>
            ),
          )}
        </div>
      )}

      {asking && (
        <>
          <form ref={armedRef} action={asking.action} className="hidden">
            {Object.entries(asking.fields ?? {}).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          </form>

          <ConfirmDialog
            open
            title={asking.confirm ?? 'Are you sure?'}
            body={asking.confirmBody}
            word={asking.confirmWord}
            confirmLabel={asking.confirmLabel ?? asking.label}
            onCancel={() => setAsking(null)}
            onConfirm={() => {
              // Submit before clearing: clearing unmounts the form.
              armedRef.current?.requestSubmit();
              setAsking(null);
            }}
          />
        </>
      )}
    </div>
  );
}

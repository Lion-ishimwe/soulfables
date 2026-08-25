'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';

/**
 * The ⋮ menu.
 *
 * One of these sits on every row that can be changed or removed, so
 * destructive actions live in a consistent place rather than as a naked
 * "Remove" link sitting next to the thing it deletes.
 *
 * Two behaviours worth naming:
 *
 *   Destructive items ask first. A confirm() is unglamorous, but it is
 *   the one dialogue every browser renders correctly and nobody has to
 *   learn — and this is a demo where a mis-click costs someone's work.
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
      /** Shown in the confirm dialogue. Presence implies destructive. */
      confirm?: string;
    };

export function KebabMenu({
  items,
  label = 'Actions',
}: {
  items: KebabItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
            ) : (
              <form
                key={i}
                action={item.action}
                onSubmit={(e) => {
                  if (item.confirm && !window.confirm(item.confirm)) {
                    e.preventDefault();
                    return;
                  }
                  setOpen(false);
                }}
              >
                {Object.entries(item.fields ?? {}).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
                <button
                  type="submit"
                  role="menuitem"
                  className={`block w-full px-4 py-2.5 text-left font-ui text-sm transition-colors hover:bg-ink-raised ${
                    item.danger
                      ? 'text-state-danger hover:text-state-danger'
                      : 'text-grey hover:text-ivory'
                  }`}
                >
                  {item.label}
                </button>
              </form>
            ),
          )}
        </div>
      )}
    </div>
  );
}

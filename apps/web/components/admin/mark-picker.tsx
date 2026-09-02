'use client';

import { useState } from 'react';

/**
 * The mark that stands for a shelf.
 *
 * It was a text box you typed an emoji into, which means finding the
 * emoji picker in your operating system, knowing the shelf wants one
 * character rather than three, and hoping the one you chose reads at
 * 16px. This offers a set chosen for the House instead, and still lets
 * you type your own if none of them is right.
 *
 * Grouped by feeling rather than by Unicode category, because that is
 * how somebody arrives at this field: they have a shelf about grief and
 * want something that looks like grief.
 */
const MARKS: { group: string; marks: string[] }[] = [
  {
    group: 'Heart and hurt',
    marks: ['❤️', '🤍', '💛', '💔', '🫀', '🩹', '🕯️', '🥀', '🖤', '💜'],
  },
  {
    group: 'Growing',
    marks: ['🌿', '🌱', '🍃', '🌾', '🌻', '🌸', '🪴', '🌳', '🍂', '🌼'],
  },
  {
    group: 'Sky and weather',
    marks: ['🌙', '✨', '⭐', '🌠', '☁️', '🌧️', '🌈', '🌅', '🌊', '❄️'],
  },
  {
    group: 'Quiet things',
    marks: ['🕊️', '🪶', '🐚', '🔮', '🧭', '🗝️', '🪞', '⏳', '🫧', '🪷'],
  },
  {
    group: 'The House',
    marks: ['📖', '📚', '✉️', '🖋️', '📜', '🏛️', '🚪', '🪟', '🛋️', '☕'],
  },
];

export function MarkPicker({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [mark, setMark] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);

  return (
    <div>
      <span className="sf-eyebrow mb-2 block">Mark</span>

      {/* The real value. Kept in a hidden field so the form posts the same
          way whether it was picked or typed. */}
      <input type="hidden" name={name} value={mark} />

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setCustom(false);
          }}
          aria-expanded={open}
          aria-label={mark ? `Mark: ${mark}. Choose another` : 'Choose a mark'}
          className="flex h-14 w-20 shrink-0 items-center justify-center rounded border border-rule bg-ink text-2xl transition-colors hover:border-gold/50"
        >
          {mark || <span className="font-ui text-xs text-grey-muted">Choose</span>}
        </button>

        {mark && (
          <button
            type="button"
            onClick={() => setMark('')}
            className="mt-1 font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
          >
            Clear
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded border border-rule bg-ink-raised p-4">
          {MARKS.map((g) => (
            <div key={g.group} className="mb-4 last:mb-0">
              <p className="sf-eyebrow mb-2">{g.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.marks.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMark(m);
                      setOpen(false);
                    }}
                    aria-label={m}
                    aria-pressed={m === mark}
                    className={`flex h-10 w-10 items-center justify-center rounded text-xl transition-colors ${
                      m === mark ? 'bg-gold/20 ring-1 ring-gold/50' : 'hover:bg-ink-hover'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t border-rule pt-3">
            {custom ? (
              <>
                <label htmlFor="mark-custom" className="mb-2 block font-ui text-xs text-grey-muted">
                  Anything else — paste or type it
                </label>
                <input
                  id="mark-custom"
                  value={mark}
                  onChange={(e) => setMark(e.target.value.slice(0, 8))}
                  maxLength={8}
                  autoFocus
                  className="w-24 rounded border border-rule bg-ink px-3 py-2 text-center text-xl outline-none focus:border-gold/50"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setCustom(true)}
                className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
              >
                Use something else
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

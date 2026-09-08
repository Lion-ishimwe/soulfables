'use client';

import { useState } from 'react';
import { Icon } from './dashboard';
import { Avatar } from './avatar';

/**
 * One usage table, two ways of cutting it.
 *
 * It was two tables side by side, each in a third of the row, and four
 * columns do not fit in a third of a row: costs fell off the right edge
 * and "Starting a draft" wrapped onto two lines. Rather than shrink the
 * type until it fitted, this is one table in a slot wide enough for it,
 * and a select to choose whether the rows are features or people. The
 * numbers are the same numbers; only the grouping changes.
 *
 * Costs arrive pre-formatted. The pricing module is server-only, and a
 * client component that imported it would fail the build — so the server
 * does the money and this does the layout.
 */

export type UsageRow = {
  key: string;
  label: string;
  /** Feature rows carry an icon; person rows carry an avatar. */
  icon?: string;
  avatarName?: string;
  calls: number;
  tokens: number;
  cost: string;
};

type View = 'feature' | 'person';

export function UsageBreakdown({
  features,
  people,
}: {
  features: UsageRow[];
  people: UsageRow[];
}) {
  const [view, setView] = useState<View>('feature');
  const rows = view === 'feature' ? features : people;

  const th =
    'px-4 py-2.5 text-left font-ui text-micro font-normal uppercase tracking-[0.12em] text-grey-faint';
  const num = 'w-0 whitespace-nowrap px-4 py-3 text-right font-ui text-sm tabular-nums';

  return (
    <section className="flex h-full flex-col rounded-lg border border-rule bg-ink-raised">
      <header className="flex items-center justify-between gap-4 border-b border-rule px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-ui text-sm text-ivory">Usage</h2>
          <p className="mt-0.5 font-ui text-micro text-grey-faint">
            {view === 'feature' ? 'What the money went on' : 'Who asked for it'}
          </p>
        </div>

        <label className="flex shrink-0 items-center gap-2">
          <span className="sr-only">Group usage by</span>
          <select
            value={view}
            onChange={(e) => setView(e.target.value as View)}
            className="rounded-md border border-rule bg-ink px-3 py-1.5 font-ui text-xs text-ivory outline-none transition-colors focus:border-gold/50"
          >
            <option value="feature" className="bg-ink">By feature</option>
            <option value="person" className="bg-ink">By person</option>
          </select>
        </label>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-center font-ui text-xs leading-relaxed text-grey-muted">
          {view === 'feature'
            ? 'Nothing written with the assistant in this window.'
            : 'Nobody has used the assistant in this window.'}
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-rule">
              <th className={th}>{view === 'feature' ? 'Feature' : 'User'}</th>
              <th className={`${th} w-0 whitespace-nowrap text-right`}>Calls</th>
              <th className={`${th} w-0 whitespace-nowrap text-right`}>Tokens</th>
              <th className={`${th} w-0 whitespace-nowrap text-right`}>Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {rows.map((r) => (
              <tr key={r.key}>
                {/*
                  max-w-0 is what makes the truncation real. An auto-layout
                  cell grows to fit its content, so a long email address
                  pushed the three number columns off the right edge; with a
                  zero max-width the cell takes only what is left after the
                  numbers, and the label inside it ellipsises instead.
                */}
                <td className="w-full max-w-0 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {r.icon && <Icon name={r.icon} className="h-4 w-4 shrink-0 text-gold" />}
                    {r.avatarName && <Avatar src={null} name={r.avatarName} size={26} />}
                    <span className="truncate font-ui text-sm text-ivory">{r.label}</span>
                  </span>
                </td>
                <td className={`${num} text-grey-muted`}>{r.calls}</td>
                <td className={`${num} text-grey-muted`}>{r.tokens.toLocaleString()}</td>
                <td className={`${num} text-ivory`}>{r.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

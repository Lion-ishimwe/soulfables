'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';

/**
 * The range control.
 *
 * A native <select> that navigates on change, rather than a scripted
 * menu. It is a real control with a keyboard, it is the system picker on
 * a phone, and the choice ends up in the URL — so the dashboard someone
 * is looking at is the dashboard they can send to somebody else.
 *
 * This is the only client component on the page. Everything else,
 * charts included, renders on the server.
 */
export function RangeSelect({
  param,
  value,
  options,
}: {
  param: string;
  value: string;
  options: readonly { key: string; label: string }[];
}) {
  const router = useRouter();
  const search = useSearchParams();

  return (
    <span className="relative inline-block">
      <select
        aria-label="Time range"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(search.toString());
          next.set(param, e.target.value);
          router.push(`/admin?${next.toString()}` as Route);
        }}
        className="cursor-pointer appearance-none rounded border border-rule bg-ink py-1.5 pl-3 pr-9 font-ui text-xs text-grey transition-colors hover:text-ivory focus:outline-none focus:ring-1 focus:ring-gold/40"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-micro text-grey-muted">
        ▾
      </span>
    </span>
  );
}

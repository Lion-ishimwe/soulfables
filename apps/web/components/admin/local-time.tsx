'use client';

import { useEffect, useState } from 'react';

/**
 * A moment, written the way this browser writes moments.
 *
 * The server does not know where the reader is; it renders in its own
 * zone (UTC, on the instance) and would print a time that is right and
 * useless. So the server writes the instant in UTC and the browser
 * rewrites it in local time as soon as it can — the mismatch between
 * the two renders is expected, and suppressed rather than warned about.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState(() => format(iso, 'UTC'));

  useEffect(() => {
    setText(format(iso));
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning className={className} title={iso}>
      {text}
    </time>
  );
}

function format(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  });
}

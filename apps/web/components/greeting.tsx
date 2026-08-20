'use client';

import { useEffect, useState } from 'react';

/**
 * "Good afternoon." — the House greets by local time.
 *
 * This has to be client-rendered: the server has no idea what time it is
 * where the reader is sitting, and a server-rendered "Good morning" shown
 * to someone at midnight is worse than a beat of delay. Rendered as an
 * empty reserved line first so nothing shifts when it fills in.
 */
function greetingFor(hour: number): string {
  if (hour < 5) return 'Still awake.';
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  if (hour < 22) return 'Good evening.';
  return 'Late, isn’t it.';
}

export function Greeting() {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  return (
    <p
      className="min-h-[1.75rem] font-display text-xl italic text-gold"
      // The line is decorative; screen readers get the h1 instead.
      aria-hidden={greeting === null}
    >
      {greeting ?? ' '}
    </p>
  );
}

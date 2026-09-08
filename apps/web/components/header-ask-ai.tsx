'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AskAI } from '@/components/studio/ask-ai';

/**
 * Ask AI, in the header — so it is one click away on every page rather
 * than only in the Writing Room.
 *
 * Shown to staff, and to authors the House has switched it on for; the
 * answer comes from /api/me on each navigation, the same way the account
 * corner learns who is signed in, because the header is static and
 * cannot read a cookie. Nobody else sees a button they could not use.
 *
 * On a story's own page the panel knows which story is open, taken from
 * the address rather than passed in, since the header sits above every
 * page and is told nothing by any of them.
 */
export function HeaderAskAI() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { signedIn?: boolean; aiAccess?: boolean }) => {
        if (active) setAllowed(Boolean(me.signedIn && me.aiAccess));
      })
      .catch(() => active && setAllowed(false));
    return () => {
      active = false;
    };
  }, [pathname]);

  if (!allowed) return null;

  const story =
    pathname.match(/^\/studio\/([^/]+)\/?$/)?.[1] ??
    pathname.match(/^\/admin\/stories\/(?!new$)([^/]+)\/?$/)?.[1] ??
    undefined;

  return <AskAI storySlug={story ? decodeURIComponent(story) : undefined} compact />;
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';


/**
 * The account corner of the header.
 *
 * Auth state is read in the browser rather than on the server, and that
 * is a deliberate trade. Calling cookies() in the root layout would opt
 * every page in the site out of static generation — including all 32
 * story pages, which are the pages that most need to be fast and
 * indexable. So the shell stays static and this one corner hydrates.
 *
 * The cost is a brief moment where the header shows neither state. It is
 * rendered as a fixed-width slot so nothing shifts when it resolves.
 */
export function AccountMenu({ mobile = false }: { mobile?: boolean }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading');

  // One source of truth for "is anyone signed in", shared with the
  // reader controls. Asking the server also covers demo sessions, which
  // a Supabase client knows nothing about.
  useEffect(() => {
    let active = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { signedIn: boolean }) => {
        if (active) setState(me.signedIn ? 'in' : 'out');
      })
      .catch(() => active && setState('out'));
    return () => {
      active = false;
    };
  }, []);

  if (mobile) {
    return (
      <Link
        href={state === 'in' ? '/account/library' : '/signin'}
        className="block border-b border-rule py-4 font-display text-2xl text-ivory last:border-0"
      >
        {state === 'in' ? 'My Library' : 'Sign In'}
      </Link>
    );
  }

  return (
    <span className="hidden min-w-[5.5rem] justify-end md:flex">
      {state === 'loading' ? (
        <span aria-hidden="true">&nbsp;</span>
      ) : state === 'in' ? (
        <Link
          href="/account/library"
          className="font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
        >
          My Library
        </Link>
      ) : (
        <Link
          href="/signin"
          className="font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
        >
          Sign In
        </Link>
      )}
    </span>
  );
}

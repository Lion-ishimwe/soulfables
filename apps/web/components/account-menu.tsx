'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/app/actions/auth';

/**
 * The account corner of the header.
 *
 * Auth state is read from /api/me rather than on the server, because
 * calling cookies() in the root layout would opt every page out of static
 * generation — including the story pages, which are the ones that most
 * need to be fast and indexable. So the shell stays static and this one
 * corner hydrates.
 *
 * Signing out lives here. It used to exist only on /account/settings,
 * which meant a reader looking at their own library had no way out and
 * nothing pointing at one. Sign-out belongs where people look for it,
 * which is under their own name.
 */

const ITEMS = [
  { href: '/account/library', label: 'My Library' },
  { href: '/journal', label: 'Reading Journal' },
  { href: '/account/orders', label: 'Orders' },
  { href: '/account/settings', label: 'Account' },
] as const;

type State =
  | { status: 'loading' }
  | { status: 'out' }
  | { status: 'in'; name: string };

export function AccountMenu({ mobile = false }: { mobile?: boolean }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  /*
   * Re-checked on every navigation, not once on mount.
   *
   * Signing in is a server action that redirects, and a redirect does not
   * remount the layout — so a mount-only fetch left the header showing
   * "Sign In" to somebody who was already signed in, with no menu and
   * therefore no way to sign out again. Keying on the pathname makes the
   * header agree with the page it is sitting above.
   */
  useEffect(() => {
    let active = true;
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((me: { signedIn: boolean; displayName?: string }) => {
        if (!active) return;
        setState(
          me.signedIn
            ? { status: 'in', name: me.displayName || 'Your shelf' }
            : { status: 'out' },
        );
      })
      .catch(() => active && setState({ status: 'out' }));
    return () => {
      active = false;
    };
  }, [pathname]);

  // A navigation also closes any open menu.
  useEffect(() => setOpen(false), [pathname]);

  // Close on outside click and on Escape — a menu you cannot dismiss is
  // its own small trap.
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

  // --- Mobile: everything inline, no dropdown ---------------------------
  if (mobile) {
    if (state.status !== 'in') {
      return (
        <Link
          href="/signin"
          className="block border-b border-rule py-4 font-display text-2xl text-ivory last:border-0"
        >
          Sign In
        </Link>
      );
    }

    return (
      <>
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block border-b border-rule py-4 font-display text-2xl text-ivory"
          >
            {item.label}
          </Link>
        ))}
        <form action={signOut}>
          <button
            type="submit"
            className="block w-full py-4 text-left font-display text-2xl text-grey-muted transition-colors hover:text-ivory"
          >
            Sign out
          </button>
        </form>
      </>
    );
  }

  // --- Desktop -----------------------------------------------------------
  if (state.status === 'loading') {
    // Reserved width so nothing shifts when it resolves.
    return <span className="hidden min-w-[5.5rem] md:block" aria-hidden="true" />;
  }

  if (state.status === 'out') {
    return (
      <Link
        href="/signin"
        className="hidden min-w-[5.5rem] text-right font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory md:block"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-w-[5.5rem] items-center justify-end gap-2 font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
      >
        <span className="max-w-[9rem] truncate">{state.name}</span>
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden="true"
          className={`flex-none transition-transform duration-base ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1 1.25 4.5 4.75 8 1.25" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-3 w-52 border border-rule bg-ink shadow-lift"
        >
          <ul className="py-1">
            {ITEMS.map((item) => (
              <li key={item.href} role="none">
                <Link
                  role="menuitem"
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 font-ui text-sm text-grey transition-colors hover:bg-ink-raised hover:text-ivory"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <form action={signOut} className="border-t border-rule">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left font-ui text-sm text-grey-muted transition-colors hover:bg-ink-raised hover:text-ivory"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

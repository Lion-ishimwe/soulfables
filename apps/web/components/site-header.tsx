'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AccountMenu } from '@/components/account-menu';

/**
 * The House navigation. Order matches the live site exactly — readers
 * already have muscle memory for it.
 */
const NAV = [
  { href: '/library', label: 'Library' },
  { href: '/wander', label: 'Wander' },
  { href: '/journal', label: 'Reading Journal' },
  { href: '/companion', label: 'Librarian' },
  { href: '/shop', label: 'Bookshop' },
  { href: '/residents', label: 'Residents' },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-ivory transition-colors duration-base ease-house hover:text-gold"
        >
          Soulfables
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`font-ui text-sm transition-colors duration-base ease-house ${
                  active ? 'text-gold' : 'text-grey-muted hover:text-ivory'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/search"
            aria-label="Search the library"
            className="hidden text-grey-muted transition-colors duration-base ease-house hover:text-ivory sm:block"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>

          <AccountMenu />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="text-grey-muted transition-colors duration-base ease-house hover:text-ivory md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              {open ? (
                <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 8h16M4 16h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="border-t border-rule bg-ink px-5 pb-6 pt-2 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block border-b border-rule py-4 font-display text-2xl text-ivory"
            >
              {item.label}
            </Link>
          ))}
          <AccountMenu mobile />
        </nav>
      )}
    </header>
  );
}

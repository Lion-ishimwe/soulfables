'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

/**
 * Settings is now three pages, so it needs to look like one place.
 *
 * The House is what Soulfables says about itself, Featured is what it
 * puts in front of readers, and Account is you. They belong together
 * because they are all "configuration" and none of them is content — but
 * they are separate pages because each is a different job with a
 * different save.
 */
const TABS = [
  { href: '/admin/settings', label: 'The House', exact: true },
  { href: '/admin/settings/featured', label: 'Featured', exact: false },
  { href: '/admin/settings/account', label: 'Account', exact: false },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="mb-6 flex gap-1 overflow-x-auto border-b border-rule"
    >
      {TABS.map((t) => {
        const on = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 font-ui text-sm transition-colors ${
              on
                ? 'border-gold text-gold'
                : 'border-transparent text-grey-muted hover:text-ivory'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

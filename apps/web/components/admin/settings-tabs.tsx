'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

/**
 * Settings is now three pages, so it needs to look like one place.
 *
 * The House is what Soulfables says about itself, Featured is what it
 * puts in front of readers, Account is you, Access is which writers may
 * use the assistant, Billing is what the writing assistant costs and
 * whether its key still works, and Report and the
 * Audit log are what has happened. They belong together because none of them is
 * content — but they are separate pages because each is a different job.
 *
 * Administration used to be its own group holding Readers, Analytics and
 * the audit log. Three items is not a section, and two of them were
 * halves of one question, so Analytics and Readers became Report and the
 * group went away.
 */
const TABS = [
  { href: '/admin/settings', label: 'The House', exact: true },
  { href: '/admin/settings/featured', label: 'Featured', exact: false },
  { href: '/admin/settings/questions', label: 'Questions', exact: false },
  { href: '/admin/settings/account', label: 'Account', exact: false },
  { href: '/admin/settings/access', label: 'Access', exact: false },
  { href: '/admin/settings/billing', label: 'Billing', exact: false },
  { href: '/admin/settings/report', label: 'Report', exact: false },
  { href: '/admin/settings/audit', label: 'Audit log', exact: false },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      /*
        overflow-x-auto is here so six tabs can scroll on a phone. It has a
        side effect: overflow-y computes to auto as well, and the links used
        to carry -mb-px so the active tab's gold line would sit over the
        nav's grey one — one pixel of vertical overflow, and Windows drew
        a full vertical scrollbar for it. The margin is gone (the gold
        line now sits just above the grey one, which is fine) and the
        scrollbar is hidden the way the admin's other tab rows hide it.
      */
      className="mb-6 flex gap-1 overflow-x-auto border-b border-rule [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((t) => {
        const on = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={on ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-4 py-3 font-ui text-sm transition-colors ${
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

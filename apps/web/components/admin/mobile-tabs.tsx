'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/auth';
import { Icon } from './dashboard';

/**
 * The admin, on a phone.
 *
 * A sidebar cannot follow you down a narrow screen, and the fallback —
 * the whole section list stacked above the page — pushed the actual
 * content below the fold on every single view. Four destinations at the
 * bottom, where a thumb is, and everything else behind More.
 *
 * Which four: the ones somebody opens the admin to do. Stories is the
 * work, Products and Orders are the shop, Overview is where you land.
 * Shelves, Authors, Featured and the rest are edited rarely and live one
 * tap away rather than competing for a permanent slot.
 */
const PRIMARY = [
  { href: '/admin', label: 'Overview', icon: 'spark', exact: true },
  { href: '/admin/stories', label: 'Stories', icon: 'book', exact: false },
  { href: '/admin/products', label: 'Products', icon: 'box', exact: false },
  { href: '/admin/orders', label: 'Orders', icon: 'cart', exact: false },
] as const;

const MORE = [
  { heading: 'Content', items: [
    { href: '/admin/submissions', label: 'Submissions', icon: 'draft' },
    { href: '/admin/shelves', label: 'Shelves', icon: 'layers' },
    { href: '/admin/authors', label: 'Authors', icon: 'people' },
  ]},
  { heading: 'Commerce', items: [
    { href: '/admin/entitlements', label: 'Entitlements', icon: 'book' },
    { href: '/admin/subscriptions', label: 'Residency', icon: 'people' },
  ]},
  { heading: 'House', items: [
    { href: '/admin/letter', label: 'Weekly Letter', icon: 'draft' },
    { href: '/admin/prompts', label: 'Journal prompts', icon: 'spark' },
  ]},
  ] as const;

export function MobileTabs({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const isAdmin = role === 'admin' || role === 'owner';

  const activeTab = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  // "More" counts as current when you are somewhere it contains.
  const inMore =
    !PRIMARY.some((t) => activeTab(t.href, t.exact)) &&
    pathname.startsWith('/admin');

  return (
    <>
      {sheet && (
        <div
          className="fixed inset-0 z-40 bg-ink/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSheet(false)}
          aria-hidden="true"
        />
      )}

      {sheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All sections"
          className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-rule bg-ink-raised pb-24 lg:hidden"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-rule bg-ink-raised px-5 py-4">
            <h2 className="font-ui text-sm text-ivory">All sections</h2>
            <button
              type="button"
              onClick={() => setSheet(false)}
              aria-label="Close"
              className="rounded p-1 text-grey-muted transition-colors hover:text-ivory"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="px-3 py-3">
            {MORE.filter((g) => !('adminOnly' in g && g.adminOnly) || isAdmin).map((group) => (
              <div key={group.heading} className="mb-5">
                <p className="sf-eyebrow mb-2 px-3">{group.heading}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href as Route}
                        onClick={() => setSheet(false)}
                        className={`flex items-center gap-3 rounded px-3 py-3 font-ui text-sm transition-colors ${
                          pathname.startsWith(item.href)
                            ? 'bg-gold/10 text-gold'
                            : 'text-grey hover:bg-ink-hover hover:text-ivory'
                        }`}
                      >
                        <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*
        pb-[env(safe-area-inset-bottom)] keeps the labels clear of the
        home indicator on a modern iPhone, where the bottom of the screen
        is not the bottom of the usable screen.
      */}
      <nav
        aria-label="Main sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {PRIMARY.map((tab) => {
            const on = activeTab(tab.href, tab.exact);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href as Route}
                  aria-current={on ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 font-ui text-micro transition-colors ${
                    on ? 'text-gold' : 'text-grey-muted'
                  }`}
                >
                  <Icon name={tab.icon} className="h-5 w-5" />
                  {tab.label}
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setSheet((v) => !v)}
              aria-expanded={sheet}
              className={`flex w-full flex-col items-center gap-1 py-2.5 font-ui text-micro transition-colors ${
                sheet || inMore ? 'text-gold' : 'text-grey-muted'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
              More
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

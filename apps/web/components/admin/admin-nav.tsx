'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/auth';
import { Icon } from './dashboard';

/**
 * Admin navigation, grouped by what the House actually does rather than
 * by database table. "Stories" and "Shelves" sit together under Content
 * because that is one job; Orders and Entitlements sit under Commerce
 * because that is another.
 *
 * Icons earn their place by making the list scannable at a glance once
 * you know it — not by explaining it to someone who does not. The label
 * is always there and is always the thing that identifies the row.
 */
const GROUPS = [
  {
    heading: 'Content',
    items: [
      { href: '/admin/submissions', label: 'Submissions', icon: 'draft' },
      { href: '/admin/stories', label: 'Stories', icon: 'book' },
      { href: '/admin/shelves', label: 'Shelves', icon: 'layers' },
      { href: '/admin/authors', label: 'Authors', icon: 'people' },
    ],
  },
  {
    heading: 'Commerce',
    items: [
      { href: '/admin/products', label: 'Products', icon: 'box' },
      { href: '/admin/orders', label: 'Orders', icon: 'cart' },
      { href: '/admin/entitlements', label: 'Entitlements', icon: 'book' },
      { href: '/admin/subscriptions', label: 'Residency', icon: 'people' },
    ],
  },
  {
    heading: 'House',
    items: [
      { href: '/admin/letter', label: 'Weekly Letter', icon: 'draft' },
      { href: '/admin/prompts', label: 'Journal prompts', icon: 'spark' },
    ],
  },
    {
    heading: 'Settings',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: 'gear' },
      { href: '/admin/settings/featured', label: 'Featured', icon: 'spark' },
      { href: '/admin/settings/account', label: 'Account', icon: 'people' },
      { href: '/admin/settings/report', label: 'Report', icon: 'spark' },
      { href: '/admin/settings/audit', label: 'Audit log', icon: 'clock' },
    ],
  },
] as const;

export function AdminNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const isAdmin = role === 'admin' || role === 'owner';

  const row = (active: boolean) =>
    `flex items-center gap-3 rounded px-3 py-2 font-ui text-sm transition-colors ${
      active
        ? 'bg-gold/10 text-gold'
        : 'text-grey hover:bg-ink-hover hover:text-ivory'
    }`;

  return (
    <nav aria-label="Admin sections" className="py-6">
      <Link
        href={'/admin' as Route}
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className={row(pathname === '/admin')}
      >
        <Icon name="spark" className="h-4 w-4 shrink-0" />
        Overview
      </Link>

      {GROUPS.filter((g) => !('adminOnly' in g && g.adminOnly) || isAdmin).map((group) => (
        <div key={group.heading} className="mt-6">
          <p className="sf-eyebrow mb-2 px-3">{group.heading}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href as Route}
                    aria-current={active ? 'page' : undefined}
                    className={row(active)}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/auth';

/**
 * Admin navigation, grouped by what the House actually does rather than
 * by database table. "Stories" and "Shelves" sit together under Content
 * because that is one job; Orders and Entitlements sit under Commerce
 * because that is another.
 */
const GROUPS = [
  {
    heading: 'Content',
    items: [
      { href: '/admin/submissions', label: 'Submissions' },
      { href: '/admin/stories', label: 'Stories' },
      { href: '/admin/shelves', label: 'Shelves' },
      { href: '/admin/authors', label: 'Authors' },
      { href: '/admin/featured', label: 'Featured' },
    ],
  },
  {
    heading: 'Commerce',
    items: [
      { href: '/admin/products', label: 'Products' },
      { href: '/admin/orders', label: 'Orders' },
      { href: '/admin/entitlements', label: 'Entitlements' },
      { href: '/admin/subscriptions', label: 'Residency' },
    ],
  },
  {
    heading: 'House',
    items: [
      { href: '/admin/letter', label: 'Weekly Letter' },
      { href: '/admin/prompts', label: 'Journal prompts' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { href: '/admin/users', label: 'Readers' },
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/audit', label: 'Audit log' },
    ],
    adminOnly: true,
  },
] as const;

export function AdminNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const isAdmin = role === 'admin' || role === 'owner';

  return (
    <nav
      aria-label="Admin sections"
      className="hidden w-52 flex-none border-r border-rule py-10 pr-6 lg:block"
    >
      <Link
        href="/admin"
        className={`mb-8 block font-ui text-sm transition-colors ${
          pathname === '/admin' ? 'text-gold' : 'text-grey-muted hover:text-ivory'
        }`}
      >
        Overview
      </Link>

      {GROUPS.filter((g) => !('adminOnly' in g && g.adminOnly) || isAdmin).map(
        (group) => (
          <div key={group.heading} className="mb-7">
            <p className="sf-eyebrow mb-3">{group.heading}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block py-1 font-ui text-sm transition-colors ${
                        active ? 'text-gold' : 'text-grey hover:text-ivory'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </nav>
  );
}

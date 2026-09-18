import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { unreadNotifications } from '@/lib/admin-dashboard';
import { AdminNav } from '@/components/admin/admin-nav';
import { SidebarToggle } from '@/components/admin/sidebar-toggle';
import { MobileTabs } from '@/components/admin/mobile-tabs';
import { Icon } from '@/components/admin/dashboard';
import { signOut } from '@/app/actions/auth';
import { HeaderAskAI } from '@/components/header-ask-ai';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Soulfables Admin' },
  // The admin surface is never indexed, and never previewed in a link.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Admin is a route group inside the public app rather than a separate
 * deployment — one auth session, one RLS surface, half the configuration.
 * Splitting it out later is mechanical; running two apps from week one is
 * a permanent tax.
 *
 * Three layers guard this: middleware redirects non-staff, requireStaff()
 * below re-checks on the server, and RLS returns nothing to a non-staff
 * session regardless. Any one of them failing is survivable.
 *
 * The shell is a fixed sidebar beside a scrolling column. The sidebar
 * holds its own scroll, so a long section list never pushes the identity
 * card off the bottom, and the page beneath never moves when you
 * navigate — which is most of what makes a dashboard feel like one
 * surface rather than a series of pages.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Both at once. The badge does not depend on the answer to "are you
  // staff" — the page is behind middleware either way — and waiting for
  // one before asking the other cost a round trip on every admin page.
  const [viewer, unread] = await Promise.all([requireStaff(), unreadNotifications()]);

  const name = viewer.displayName ?? viewer.email ?? 'Staff';
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-ink lg:flex">
      {/* ---- Sidebar ------------------------------------------------- */}
      <aside
        id="admin-sidebar"
        className="hidden w-60 flex-none flex-col border-r border-rule lg:sticky lg:top-0 lg:flex lg:h-screen"
      >
        <div className="border-b border-rule px-5 py-5">
          <Link href={'/admin' as Route} className="font-display text-lg text-ivory">
            Soulfables
            <span className="ml-2 font-ui text-micro uppercase tracking-[0.18em] text-gold">
              Admin
            </span>
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3">
          <AdminNav role={viewer.role} />
        </div>

        <div className="border-t border-rule p-3">
          <Link
            href={'/' as Route}
            className="mb-2 flex items-center justify-between rounded border border-rule px-3 py-2.5 font-ui text-xs text-grey transition-colors hover:border-rule-strong hover:text-ivory"
          >
            View site
            <span aria-hidden="true">↗</span>
          </Link>

          {/*
            Who you are, at the foot of the sidebar rather than only in
            the top bar. On a surface where one person may hold several
            roles, "which account am I acting as" is worth answering
            permanently rather than on hover.
          */}
          <div className="flex items-center gap-3 rounded px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 font-ui text-sm text-gold">
              {initial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-ui text-xs text-ivory">{name}</span>
              <span className="block truncate font-ui text-micro capitalize text-grey-muted">
                {viewer.role}
              </span>
            </span>
          </div>
        </div>
      </aside>

      {/* ---- Main column --------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-rule bg-ink/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-8">
            <SidebarToggle />

            <Link href={'/admin' as Route} className="font-display text-lg text-ivory lg:hidden">
              Soulfables
              <span className="ml-2 font-ui text-micro uppercase tracking-[0.18em] text-gold">
                Admin
              </span>
            </Link>

            <div className="ml-auto flex items-center gap-5">
              <HeaderAskAI />
              <Link
                href={'/studio' as Route}
                className="hidden font-ui text-xs text-grey-muted transition-colors hover:text-ivory sm:inline"
              >
                Writing Room
              </Link>
              <Link
                href={'/' as Route}
                className="hidden font-ui text-xs text-grey-muted transition-colors hover:text-ivory sm:inline"
              >
                View site ↗
              </Link>

              <span className="hidden items-center gap-2 font-ui text-xs text-grey sm:flex">
                {name}
                <span className="rounded border border-gold/50 px-2 py-0.5 text-micro uppercase tracking-wide text-gold">
                  {viewer.role}
                </span>
              </span>

              {/*
                The badge is a real count of this person's unread
                notifications — the editorial workflow writes one when a
                story is submitted, approved or returned. It is hidden
                entirely at zero rather than showing a 0, which would be
                a permanent small alarm about nothing.
              */}
              <Link
                href={'/admin/submissions' as Route}
                aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
                className="relative text-grey-muted transition-colors hover:text-ivory"
              >
                <Icon name="bell" className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-ui text-[0.625rem] text-ink">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>

              <span className="h-6 w-px bg-rule" />

              <form action={signOut}>
                <button
                  type="submit"
                  className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        {/*
          pb-24 on small screens keeps the last card clear of the bottom
          bar, which floats above the page rather than in the flow.
        */}
        {/*
          A div, not a <main>. The root layout already provides the
          document's main landmark, and nesting a second one inside it is
          invalid and leaves a screen reader with two "main" regions to
          choose between.
        */}
        <div className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-8 sm:py-8 lg:pb-8">
          {children}
        </div>

        <footer className="hidden border-t border-rule px-5 py-5 sm:px-8 lg:block">
          <div className="flex flex-wrap items-center justify-between gap-4 font-ui text-xs text-grey-muted">
            <p>© {new Date().getFullYear()} Soulfables. All rights reserved.</p>
            <nav className="flex flex-wrap items-center gap-5">
              <Link href={'/support' as Route} className="transition-colors hover:text-ivory">
                Support
              </Link>
              <Link href={'/privacy' as Route} className="transition-colors hover:text-ivory">
                Privacy Policy
              </Link>
              <Link href={'/terms' as Route} className="transition-colors hover:text-ivory">
                Terms of Service
              </Link>
              <Link href={'/digital-products' as Route} className="transition-colors hover:text-ivory">
                Digital Products
              </Link>
            </nav>
          </div>
        </footer>
      </div>

      <MobileTabs role={viewer.role} />
    </div>
  );
}

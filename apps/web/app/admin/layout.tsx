import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { AdminNav } from '@/components/admin/admin-nav';
import { signOut } from '@/app/actions/auth';

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
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireStaff();

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-wide items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="font-display text-lg text-ivory">
              Soulfables
              <span className="ml-2 font-ui text-micro uppercase tracking-[0.18em] text-gold">
                Admin
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/"
              className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
            >
              View site ↗
            </Link>
            <span className="hidden font-ui text-xs text-grey-muted sm:inline">
              {viewer.displayName ?? viewer.email}
              <span className="ml-2 border border-rule px-1.5 py-0.5 text-micro uppercase tracking-wide text-gold">
                {viewer.role}
              </span>
            </span>
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

      <div className="mx-auto flex max-w-wide gap-0 px-5 sm:px-8">
        <AdminNav role={viewer.role} />
        <main className="min-w-0 flex-1 py-10 pl-0 lg:pl-10">{children}</main>
      </div>
    </div>
  );
}

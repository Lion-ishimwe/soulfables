import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { getPlan } from '@/lib/membership';
import { signOut } from '@/app/actions/auth';
import { AccountForm } from '@/components/account/account-form';
import { myAuthor } from '@/lib/author-accounts';
import { createClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/demo/mode';
import { DeleteAccount } from '@/components/account/delete-account';
import { ThemeChooser } from '@/components/account/theme-chooser';
import { getChosenTheme } from '@/lib/reader-settings';
import { isStaff } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/*
 * Account settings.
 *
 * The section worth noticing is at the bottom: a plain statement of what
 * the House keeps. Brief §11 makes the journal private by default, and a
 * settings page that never mentions that is describing the promise rather
 * than honouring it.
 */
export default async function AccountSettingsPage() {
  const [viewer, plan, chosenTheme] = await Promise.all([
    requireViewer('/account/settings'),
    getPlan(),
    getChosenTheme(),
  ]);
  const premium = plan === 'resident' || isStaff(viewer.role);

  const links = [
    { href: '/account/library', label: 'My Library', copy: 'What you own, kept, and are part-way through' },
    { href: '/journal', label: 'Reading Journal', copy: 'Private, including from us' },
    { href: '/account/orders', label: 'Orders', copy: 'Receipts and files' },
    { href: '/companion', label: 'The Librarian', copy: 'A companion for reflection' },
  ] as const;

  /*
   * The same form the admin and the writing room use.
   *
   * This page was a list of links and a sign-out button — there was
   * nowhere for a reader to change their own name, and the only way to
   * change a password was to send yourself a reset email.
   */
  const author = await myAuthor();

  let profileBio: string | null = null;
  if (!author && !isDemoMode()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', viewer.id)
      .maybeSingle();
    profileBio = (data?.bio as string) ?? null;
  }

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="mb-12">
        <p className="sf-eyebrow">Your shelf</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory">
          Account
        </h1>
      </header>

      <section className="mb-10 border border-rule">
        <dl className="divide-y divide-rule">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
            <dt className="font-ui text-sm text-grey-muted">Name</dt>
            <dd className="text-ivory">{viewer.displayName ?? '—'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
            <dt className="font-ui text-sm text-grey-muted">Email</dt>
            <dd className="text-ivory">{viewer.email ?? '—'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
            <dt className="font-ui text-sm text-grey-muted">Tier</dt>
            <dd className="flex items-center gap-3">
              <span className="text-ivory">
                {plan === 'resident' ? 'Premium' : 'Free'}
              </span>
              <Link
                href="/membership"
                className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
              >
                Change
              </Link>
            </dd>
          </div>
          {viewer.role !== 'reader' && (
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-4">
              <dt className="font-ui text-sm text-grey-muted">Role</dt>
              <dd className="flex items-center gap-3">
                <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                  {viewer.role}
                </span>
                <Link
                  href="/admin"
                  className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
                >
                  Open admin
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <div className="mb-10">
        <AccountForm
          displayName={viewer.displayName ?? ''}
          bio={author ? author.bio : profileBio}
          email={viewer.email}
          isAuthor={Boolean(author)}
          authorSlug={author?.slug ?? null}
        />
      </div>

      <ThemeChooser current={chosenTheme} allowed={premium} />

      <section className="mb-10">
        <h2 className="sf-eyebrow mb-4">Elsewhere</h2>
        <ul className="grid gap-px bg-rule sm:grid-cols-2">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="block h-full bg-ink p-6 transition-colors hover:bg-ink-raised"
              >
                <p className="font-display text-xl text-ivory">{l.label}</p>
                <p className="mt-1 text-sm text-grey-muted">{l.copy}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 border-l-2 border-rule-strong pl-6">
        <h2 className="sf-eyebrow mb-3">What the House keeps</h2>
        <p className="max-w-measure text-sm leading-normal text-grey-muted">
          Your email, what you have read and kept, and whatever you write in
          the journal. Journal entries are private — no member of staff can
          read them, and no database policy grants that. Nothing is sold, and
          you are not followed around other sites. The{' '}
          <Link href="/privacy" className="text-gold transition-colors hover:text-gold-soft">
            privacy page
          </Link>{' '}
          says all of it.
        </p>
      </section>

      {/*
        Your data, in your hands. A file of everything, and the door out.
        Both are the reader's right; neither should need an email to us.
      */}
      <section className="mb-10">
        <h2 className="sf-eyebrow mb-4">Your data</h2>
        <div className="grid gap-px bg-rule sm:grid-cols-2">
          <div className="bg-ink p-6">
            <p className="font-display text-xl text-ivory">Take a copy</p>
            <p className="mt-1 text-sm text-grey-muted">
              Everything the House holds about you — orders, shelf, reading, journal — as one file.
            </p>
            <a
              href="/api/account/export"
              className="mt-4 inline-block border border-rule px-5 py-2 font-ui text-xs uppercase tracking-[0.16em] text-grey transition-all hover:border-gold/50 hover:text-gold"
            >
              Download my data
            </a>
          </div>
          <div className="bg-ink p-6">
            <p className="font-display text-xl text-ivory">Leave the House</p>
            <p className="mt-1 text-sm text-grey-muted">
              Delete the account and everything in it. Receipts stay, unattached to you.
            </p>
            <div className="mt-4">
              <DeleteAccount email={viewer.email} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rule pt-8">
        <div className="flex flex-wrap items-center gap-5">
          <form action={signOut}>
            <button
              type="submit"
              className="border border-rule px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-colors hover:border-ivory/30 hover:text-ivory"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/privacy"
            className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
          >
            Privacy
          </Link>
        </div>
      </section>
    </div>
  );
}

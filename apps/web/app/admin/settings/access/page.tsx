import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { listAdminAuthors, listAuthorAccounts } from '@/lib/admin-data';
import { isDemoMode } from '@/lib/demo/mode';
import { formatDate } from '@/lib/format';
import { AdminPageHeader, StatusDot } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { Avatar } from '@/components/admin/avatar';
import { setAuthorAiAccess } from '@/app/actions/editorial';

export const metadata: Metadata = { title: 'Access' };
export const dynamic = 'force-dynamic';

/**
 * Settings → Access: who may use the writing assistant.
 *
 * One switch per author with an account. Staff are not listed because
 * staff always may — the switch exists for the people whose use of it
 * spends the House's money without being the House.
 *
 * Only authors who can sign in appear. A House voice has no desk, and a
 * person without an account has nowhere to use the assistant yet; the
 * invitation is the earlier decision, made on the Authors page.
 */
export default async function AccessSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string; to?: string }>;
}) {
  await requireStaff();
  const [{ changed, to }, authors, accounts] = await Promise.all([
    searchParams,
    listAdminAuthors(),
    listAuthorAccounts(),
  ]);

  const rows = accounts
    .map((account) => ({
      account,
      author: authors.find((a) => a.slug === account.authorSlug) ?? null,
    }))
    .filter((r) => r.author && !r.author.isPersona)
    .sort((a, b) => (a.author!.name ?? '').localeCompare(b.author!.name ?? ''));

  const allowed = rows.filter((r) => r.account.aiAccess).length;
  const th = 'px-5 py-3.5 text-left font-normal font-ui text-micro uppercase tracking-[0.14em] text-grey-faint';

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-ivory">The writing assistant</h2>
          <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">
            Ask AI, concept proposals and drafts, for the writers you choose. Every
            call is paid for by the House and shows on{' '}
            <Link href={'/admin/settings/billing' as Route} className="text-gold transition-colors hover:text-gold-soft">
              Billing
            </Link>
            , by person. Staff always have it; new authors do not until you say so.
          </p>
        </div>
        <p className="font-ui text-xs text-grey-muted">
          {rows.length === 0
            ? 'No authors with accounts yet.'
            : `${allowed} of ${rows.length} ${rows.length === 1 ? 'author has' : 'authors have'} it.`}
        </p>
      </div>

      {changed && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          {to === 'on' ? `${changed} can use the assistant from now.` : `${changed} no longer has the assistant.`}
        </p>
      )}

      {isDemoMode() && (
        <p className="mb-6 rounded border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          The demo has no switch to flip: every writer here already has the assistant.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-rule bg-ink-raised px-6 py-12 text-center">
          <p className="font-display text-xl text-ivory">Nobody to give it to yet.</p>
          <p className="mx-auto mt-2 max-w-md font-ui text-sm leading-relaxed text-grey-muted">
            An author needs an account before the assistant means anything. Invite
            one from{' '}
            <Link href={'/admin/authors' as Route} className="text-gold transition-colors hover:text-gold-soft">
              Authors
            </Link>
            , then come back here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule bg-ink-raised">
          <table className="w-full min-w-[40rem]">
            <thead>
              <tr className="border-b border-rule">
                <th className={th}>Author</th>
                <th className={th}>Account</th>
                <th className={`${th} w-44`}>Assistant</th>
                <th className={`${th} w-32`}>
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, author }) => (
                <tr
                  key={account.authorSlug}
                  className="border-b border-rule/60 transition-colors last:border-0 hover:bg-ink-hover"
                >
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/authors/${author!.slug}` as Route}
                      className="flex items-center gap-3.5"
                    >
                      <Avatar src={author!.avatarUrl} name={author!.name} isPersona={false} />
                      <span className="block truncate font-ui text-sm text-ivory">{author!.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="block truncate font-ui text-sm text-ivory">{account.email}</span>
                    <span className="block font-ui text-xs text-grey-muted">
                      since {formatDate(account.invitedAt)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {account.aiAccess ? (
                      <StatusDot tone="active" label="Can use it" />
                    ) : (
                      <StatusDot tone="idle" label="Not yet" />
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <form action={setAuthorAiAccess}>
                      <input type="hidden" name="slug" value={account.authorSlug} />
                      <input type="hidden" name="allow" value={account.aiAccess ? '0' : '1'} />
                      <button
                        type="submit"
                        disabled={isDemoMode()}
                        className={`whitespace-nowrap border px-4 py-2 font-ui text-xs uppercase tracking-[0.14em] transition-all disabled:opacity-50 ${
                          account.aiAccess
                            ? 'border-rule text-grey-muted hover:border-state-danger/60 hover:text-ivory'
                            : 'border-gold/50 text-gold hover:bg-gold hover:text-ink'
                        }`}
                      >
                        {account.aiAccess ? 'Withdraw' : 'Allow'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { listAdminAuthors, listAuthorAccounts } from '@/lib/admin-data';
import { EmptyState } from '@/components/admin/ui';
import { AdminPageHeader, StatusDot } from '@/components/admin/dashboard';
import { NewAuthorModal } from '@/components/admin/new-author-modal';
import { InviteAuthorModal } from '@/components/admin/invite-author-modal';
import { Avatar } from '@/components/admin/avatar';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { deleteAuthor } from '@/app/actions/editorial';
import { revokeAuthorAccount } from '@/app/actions/workflow';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Authors' };
export const dynamic = 'force-dynamic';

/*
 * Authors, and House voices.
 *
 * The persona column earns its place: it is the difference between a
 * byline the site presents as a person and one it does not. Getting that
 * wrong means publishing structured data claiming a fictional keeper of a
 * fictional house is a real writer.
 */
export default async function AuthorsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [{ saved, deleted }, authors, accounts] = await Promise.all([
    searchParams,
    listAdminAuthors(),
    listAuthorAccounts(),
  ]);

  const accountFor = (slug: string) =>
    accounts.find((a) => a.authorSlug === slug) ?? null;

  const th = 'px-5 py-3.5 text-left font-normal font-ui text-micro uppercase tracking-[0.14em] text-grey-faint';

  return (
    <>
      <AdminPageHeader
        title="Authors"
        subtitle="Who writes for the House — and which of them are the House itself."
        action={<NewAuthorModal />}
      />

      {saved && (
        <p className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          Saved “{saved}”.
        </p>
      )}
      {deleted && (
        <p className="mb-6 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
          Author removed. Their stories kept their place and simply lost a byline.
        </p>
      )}

      {authors.length === 0 ? (
        <EmptyState
          title="Nobody yet."
          body="Stories can stand without a byline, but most want one."
          action={{ href: '/admin/authors/new', label: 'Add the first' }}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule bg-ink-raised">
          <table className="w-full min-w-[52rem]">
            <thead>
              <tr className="border-b border-rule">
                <th className={th}>Author</th>
                <th className={th}>Kind</th>
                <th className={th}>Biography</th>
                <th className={`${th} w-24`}>Stories</th>
                <th className={`${th} w-56`}>Account</th>
                <th className={`${th} w-20`}>Order</th>
                <th className={`${th} w-12`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {authors.map((a) => {
                const account = accountFor(a.slug);

                return (
                  <tr
                    key={a.slug}
                    className="border-b border-rule/60 transition-colors last:border-0 hover:bg-ink-hover"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/authors/${a.slug}` as Route}
                        className="flex items-center gap-3.5"
                      >
                        <Avatar src={a.avatarUrl} name={a.name} isPersona={a.isPersona} />
                        <span className="min-w-0">
                          <span className="block truncate font-ui text-sm text-ivory">
                            {a.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-micro text-grey-faint">
                            {a.slug}
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td className="px-5 py-4">
                      {a.isPersona ? (
                        <span className="whitespace-nowrap rounded border border-gold/45 px-2.5 py-1 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                          House voice
                        </span>
                      ) : (
                        <span className="font-ui text-sm text-grey-muted">Person</span>
                      )}
                    </td>

                    <td className="max-w-sm px-5 py-4">
                      {a.bio ? (
                        <span className="line-clamp-2 font-ui text-sm leading-relaxed text-grey-muted">
                          {a.bio}
                        </span>
                      ) : (
                        <span className="font-ui text-sm text-grey-faint">—</span>
                      )}
                    </td>

                    <td className="px-5 py-4 font-ui text-sm tabular-nums text-ivory">
                      {a.storyCount}
                    </td>

                    <td className="px-5 py-4">
                      {/*
                        Three states, not two. A House voice has no account
                        and never will; a person without one is waiting for
                        an invitation. Collapsing those into "no account"
                        would make The Librarian look like an oversight.
                      */}
                      {a.isPersona ? (
                        <>
                          <StatusDot tone="idle" label="House voice" />
                          <span className="mt-1 block font-ui text-xs text-grey-faint">
                            No account
                          </span>
                        </>
                      ) : account ? (
                        <>
                          <StatusDot tone="active" label="Active" />
                          <span className="mt-1 block truncate font-ui text-xs text-grey-muted">
                            {account.email}
                          </span>
                          <span className="block font-ui text-xs text-grey-faint">
                            since {formatDate(account.invitedAt)}
                          </span>
                        </>
                      ) : (
                        <>
                          <StatusDot tone="none" label="No account" />
                          <InviteAuthorModal authorSlug={a.slug} authorName={a.name} />
                        </>
                      )}
                    </td>

                    <td className="px-5 py-4 font-ui text-sm tabular-nums text-grey-muted">
                      {a.sortOrder}
                    </td>

                    <td className="px-5 py-4">
                      <KebabMenu
                        label={a.name}
                        items={[
                          {
                            kind: 'link',
                            label: 'Edit author',
                            href: `/admin/authors/${a.slug}` as never,
                          },
                          ...(account
                            ? [
                                {
                                  kind: 'action' as const,
                                  label: 'Revoke account',
                                  action: revokeAuthorAccount,
                                  fields: { authorSlug: a.slug, email: account.email },
                                  danger: true,
                                  confirm: `Revoke ${a.name}'s account? They keep their byline and their published work, but can no longer sign in.`,
                                },
                              ]
                            : []),
                          {
                            kind: 'action' as const,
                            label: 'Remove author',
                            action: deleteAuthor,
                            fields: { slug: a.slug },
                            danger: true,
                            confirm: `Remove ${a.name}? Their ${a.storyCount} stories stay published and simply lose the byline.`,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

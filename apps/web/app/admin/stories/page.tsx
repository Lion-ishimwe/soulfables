import type { Metadata } from 'next';
import Link from 'next/link';
import { listWorkStories, listAdminAuthors } from '@/lib/admin-data';
import { PageHeader, StatusPill, EmptyState } from '@/components/admin/ui';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { ReassignForm } from '@/components/admin/reassign-form';
import { approveStory, discardStory } from '@/app/actions/workflow';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Stories' };
export const dynamic = 'force-dynamic';

/*
 * Every story, in whatever state.
 *
 * Two columns exist because of the workflow. "With" is who is writing it
 * now, which is not always whose name is on it — a story handed on keeps
 * its byline while the work moves. And a draft that has been sent back
 * says so, because a writer waiting on a reply and a writer who has
 * already had one need different things from this page.
 */
export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [{ saved, deleted }, stories, authors] = await Promise.all([
    searchParams,
    listWorkStories(),
    listAdminAuthors(),
  ]);

  const writers = authors
    .filter((a) => !a.isPersona)
    .map((a) => ({ slug: a.slug, name: a.name }));

  const ordered = [...stories].sort((a, b) => {
    // Anything waiting on the House first, then drafts, then the library.
    const rank = (s: (typeof stories)[number]) =>
      s.status === 'in_review' ? 0 : s.status === 'draft' ? 1 : 2;
    return rank(a) - rank(b) || a.title.localeCompare(b.title);
  });

  return (
    <>
      <PageHeader
        title="Stories"
        subtitle="Everything written, submitted or published."
        action={{ href: '/admin/stories/new', label: 'New story' }}
      />

      {saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Saved “{saved}”.
        </p>
      )}
      {deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          Story deleted.
        </p>
      )}

      {ordered.length === 0 ? (
        <EmptyState
          title="No stories yet."
          body="Write one here, or download the template from the Writing Room and bring it back when it is done."
          action={{ href: '/studio', label: 'The Writing Room' }}
        />
      ) : (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Title</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Byline</th>
                <th className="sf-eyebrow px-5 py-3 text-left">With</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Release</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Updated</th>
                <th className="sf-eyebrow px-5 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-rule">
              {ordered.map((s) => (
                <tr key={s.slug} className="transition-colors hover:bg-ink-raised">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/stories/${s.slug}`} className="block">
                      <span className="block text-ivory">{s.title}</span>
                      <span className="mt-0.5 block font-mono text-xs text-grey-muted">
                        /story/{s.slug}
                      </span>
                    </Link>
                  </td>

                  <td className="px-5 py-3.5 text-grey-muted">
                    {s.authorName ?? '—'}
                  </td>

                  <td className="px-5 py-3.5">
                    {s.assignedName ? (
                      <span
                        className={
                          s.assignedAuthorSlug !== s.authorSlug
                            ? 'text-gold'
                            : 'text-grey-muted'
                        }
                      >
                        {s.assignedName}
                      </span>
                    ) : (
                      <span className="text-xs text-grey-muted">The House</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={s.status} />
                      {s.revisionNote && s.status === 'draft' && (
                        <span
                          className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold"
                          title={s.revisionNote}
                        >
                          Sent back
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-grey-muted">
                    {s.releaseMode === 'serial' ? (
                      <span>
                        {s.chapters.filter((c) => c.status === 'published').length}
                        /{s.chapters.length} chapters
                      </span>
                    ) : (
                      <span className="text-xs">Whole</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatDate(s.publishedAt ?? s.submittedAt)}
                  </td>

                  <td className="px-5 py-3.5">
                    <KebabMenu
                      label={s.title}
                      items={[
                        {
                          kind: 'link',
                          label: 'Edit story',
                          href: `/admin/stories/${s.slug}` as never,
                        },
                        {
                          kind: 'link',
                          label: 'Open in the studio',
                          href: `/studio/${s.slug}` as never,
                        },
                        ...(s.status === 'published'
                          ? [
                              {
                                kind: 'link' as const,
                                label: 'View on site',
                                href: `/story/${s.slug}` as never,
                              },
                            ]
                          : []),
                        ...(s.status === 'in_review'
                          ? [
                              {
                                kind: 'action' as const,
                                label: 'Approve and publish',
                                action: approveStory,
                                fields: { slug: s.slug },
                              },
                            ]
                          : []),
                        {
                          kind: 'action',
                          label: 'Delete story',
                          action: discardStory,
                          fields: { slug: s.slug },
                          danger: true,
                          confirm: `Delete “${s.title}”? This cannot be undone.`,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Handing work on. */}
      {ordered.length > 0 && writers.length > 1 && (
        <section className="mt-10">
          <h2 className="sf-eyebrow mb-4">Hand a story to someone else</h2>
          <ReassignForm
            stories={ordered
              .filter((s) => s.status !== 'published')
              .map((s) => ({ slug: s.slug, title: s.title }))}
            authors={writers}
          />
        </section>
      )}
    </>
  );
}

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { listSubmissions } from '@/lib/admin-data';
import { PageHeader, EmptyState } from '@/components/admin/ui';
import { ReviewPanel } from '@/components/admin/review-panel';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Submissions' };
export const dynamic = 'force-dynamic';

/*
 * What authors have sent in.
 *
 * The House reads before anything goes out — that is the whole reason a
 * submitted story stops here rather than appearing in the library. Each
 * one can be published as it stands, or sent back with a note saying
 * what would make it ready.
 */
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string; returned?: string; needsShelf?: string; slug?: string }>;
}) {
  const [{ published, returned, needsShelf, slug: needsShelfSlug }, submissions] = await Promise.all([
    searchParams,
    listSubmissions(),
  ]);

  return (
    <>
      <PageHeader
        title="Submissions"
        subtitle="Stories waiting to be read. Nothing an author writes reaches the library without passing through here."
      />

      {published && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          “{published}” is published, and its author has been told.
        </p>
      )}
      {needsShelf && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          “{needsShelf}” has no shelf yet, and readers find every story through its shelf.{' '}
          <Link href={`/admin/stories/${needsShelfSlug ?? ''}` as Route} className="text-gold underline-offset-4 hover:underline">
            Choose one
          </Link>
          , then approve it.
        </p>
      )}
      {returned && (
        <p className="mb-6 border-l-2 border-gold bg-gold-dim px-4 py-3 text-sm text-ivory">
          Sent back with your note. It is a draft again in their studio.
        </p>
      )}

      {submissions.length === 0 ? (
        <EmptyState
          title="Nothing waiting."
          body="When an author finishes something and sends it in, it appears here before it appears anywhere else."
          action={{ href: '/admin/stories', label: 'All stories' }}
        />
      ) : (
        <ul className="space-y-px bg-rule">
          {submissions.map((s) => (
            <li key={s.slug} className="bg-ink p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="sf-eyebrow">
                    {s.assignedName ?? s.authorName ?? 'Unattributed'}
                    {' · '}
                    sent {formatDate(s.submittedAt)}
                    {s.releaseMode === 'serial' && (
                      <> · {s.chapters.length} chapters</>
                    )}
                  </p>

                  <h2 className="mt-3 font-display text-2xl font-light text-ivory">
                    {s.title}
                  </h2>

                  {s.subtitle && (
                    <p className="mt-2 max-w-measure text-sm leading-normal text-grey-muted">
                      {s.subtitle}
                    </p>
                  )}

                  <p className="mt-3 flex flex-wrap gap-3 font-ui text-xs text-grey-muted">
                    <span>{s.shelfLabel ?? 'No shelf'}</span>
                    <span>☕ {s.readingMinutes} min</span>
                    {s.access === 'premium' && (
                      <span className="text-gold">Premium only</span>
                    )}
                  </p>
                </div>

                <Link
                  href={`/admin/stories/${s.slug}`}
                  className="flex-none font-ui text-xs text-gold transition-colors hover:text-gold-soft"
                >
                  Open in the editor
                </Link>
              </div>

              {/* A taste of the opening, so a decision does not require
                  leaving the queue. */}
              <blockquote className="mt-5 max-w-prose border-l border-rule pl-5 font-reading text-sm leading-relaxed text-grey">
                {(s.releaseMode === 'serial'
                  ? (s.chapters[0]?.bodyMdx ?? '')
                  : s.bodyMdx
                )
                  .replace(/^::.*$/gm, '')
                  .trim()
                  .slice(0, 420)}
                …
              </blockquote>

              <div className="mt-6">
                <ReviewPanel slug={s.slug} title={s.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

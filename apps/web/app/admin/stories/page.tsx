import type { Metadata } from 'next';
import Link from 'next/link';
import { listStories, isReadOnly } from '@/lib/admin-data';
import { PageHeader, StatusPill, EmptyState, ReadOnlyNotice } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Stories' };
export const dynamic = 'force-dynamic';

function when(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default async function StoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const { saved, deleted } = await searchParams;
  const stories = await listStories();

  return (
    <>
      <PageHeader
        title="Stories"
        subtitle="Every folktale in the House, newest edit first."
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

      {isReadOnly() && <ReadOnlyNotice />}

      {stories.length === 0 ? (
        <EmptyState
          title="No stories yet."
          body="The library begins with one. Write it, keep it as a draft for as long as you like, and publish when it is ready."
          action={{ href: '/admin/stories/new', label: 'Write the first' }}
        />
      ) : (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="px-5 py-3 text-left sf-eyebrow">Title</th>
                <th className="px-5 py-3 text-left sf-eyebrow">Author</th>
                <th className="px-5 py-3 text-left sf-eyebrow">Status</th>
                <th className="px-5 py-3 text-right sf-eyebrow">Read</th>
                <th className="px-5 py-3 text-right sf-eyebrow">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {stories.map((s) => (
                <tr key={s.id} className="transition-colors hover:bg-ink-raised">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/stories/${s.id}`} className="block">
                      <span className="block text-ivory">{s.title}</span>
                      <span className="mt-0.5 block font-mono text-xs text-grey-muted">
                        /story/{s.slug}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-grey-muted">{s.author ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex flex-wrap gap-1.5">
                      <StatusPill status={s.status} />
                      {s.access === 'premium' && (
                        <span className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                          Residents
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {s.reading_minutes ? `${s.reading_minutes} min` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {when(s.published_at)}
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

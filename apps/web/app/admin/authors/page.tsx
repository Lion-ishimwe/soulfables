import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminAuthors } from '@/lib/admin-data';
import { PageHeader, EmptyState } from '@/components/admin/ui';

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
  const [{ saved, deleted }, authors] = await Promise.all([
    searchParams,
    listAdminAuthors(),
  ]);

  return (
    <>
      <PageHeader
        title="Authors"
        subtitle="Who writes for the House — and which of them are the House itself."
        action={{ href: '/admin/authors/new', label: 'New author' }}
      />

      {saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Saved “{saved}”.
        </p>
      )}
      {deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
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
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Name</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Kind</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Biography</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Stories</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {authors.map((a) => (
                <tr key={a.slug} className="transition-colors hover:bg-ink-raised">
                  <td className="px-5 py-3.5">
                    <Link href={`/admin/authors/${a.slug}`} className="block">
                      <span className="block text-ivory">{a.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-grey-muted">
                        {a.slug}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    {a.isPersona ? (
                      <span className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                        House voice
                      </span>
                    ) : (
                      <span className="font-ui text-xs text-grey-muted">Person</span>
                    )}
                  </td>
                  <td className="max-w-md px-5 py-3.5">
                    {a.bio ? (
                      <span className="line-clamp-2 text-grey-muted">{a.bio}</span>
                    ) : (
                      <span className="text-xs text-grey-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {a.storyCount}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {a.sortOrder}
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

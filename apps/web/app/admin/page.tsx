import type { Metadata } from 'next';
import Link from 'next/link';
import { adminCounts, isConfigured, listStories } from '@/lib/admin-data';
import { PageHeader, Stat, NotConnected, StatusPill } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const connected = isConfigured();
  const [counts, stories] = await Promise.all([adminCounts(), listStories()]);
  const recent = stories.slice(0, 6);

  return (
    <>
      <PageHeader
        title="The House"
        subtitle="Everything Soulfables publishes and sells, in one place."
        action={{ href: '/admin/stories/new', label: 'New story' }}
      />

      {!connected && (
        <div className="mb-8">
          <NotConnected />
        </div>
      )}

      <div className="mb-10 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Published" value={counts.published} hint="Live on the site" />
        <Stat label="Drafts" value={counts.drafts} hint="Not yet visible" />
        <Stat label="Products" value={counts.products} />
        <Stat label="Paid orders" value={counts.orders} />
        <Stat label="Readers" value={counts.readers} />
        <Stat label="All stories" value={counts.stories} />
      </div>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="sf-eyebrow">Recently edited</h2>
          <Link
            href="/admin/stories"
            className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            All stories →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="border border-rule px-6 py-10 text-center text-sm text-grey-muted">
            {connected
              ? 'Nothing written yet. The first page is always the hardest.'
              : 'Connect the database to see stories here.'}
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/stories/${s.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-ink-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-ui text-sm text-ivory">
                      {s.title}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-grey-muted">
                      /story/{s.slug}
                    </span>
                  </span>
                  <StatusPill status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminShelf, listAdminShelves } from '@/lib/admin-data';
import { getStories } from '@/lib/content';
import { PageHeader } from '@/components/admin/ui';
import { ShelfForm } from '@/components/admin/shelf-form';
import { deleteShelf } from '@/app/actions/editorial';

export const metadata: Metadata = { title: 'Edit shelf' };
export const dynamic = 'force-dynamic';

export default async function EditShelfPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [shelf, shelves, stories] = await Promise.all([
    getAdminShelf(slug),
    listAdminShelves(),
    getStories(),
  ]);

  if (!shelf) notFound();

  const onShelf = stories.filter((s) => s.shelf === slug);

  return (
    <>
      <PageHeader
        title={shelf.label}
        subtitle={`${shelf.storyCount} ${shelf.storyCount === 1 ? 'story' : 'stories'} on this shelf`}
      />

      {shelf.status === 'published' && (
        <p className="mb-6">
          <Link
            href={`/shelf/${shelf.slug}`}
            className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            View on site
          </Link>
        </p>
      )}

      <ShelfForm
        draft={shelf}
        shelves={shelves.map((s) => ({ slug: s.slug, label: s.label, emoji: s.emoji }))}
        stories={onShelf.map((s) => ({ slug: s.slug, title: s.title }))}
      />

      <div className="mt-12 border-t border-rule pt-6">
        <p className="sf-eyebrow mb-3">Danger</p>
        <form action={deleteShelf} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="slug" value={shelf.slug} />
          <button
            type="submit"
            className="border border-state-danger/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-state-danger transition-colors hover:bg-state-danger hover:text-ink"
          >
            Delete this shelf
          </button>
          <span className="max-w-lg text-xs leading-normal text-grey-muted">
            {shelf.storyCount > 0
              ? `${shelf.storyCount} stories sit here and would lose their shelf. Journeys pointing at it are repaired automatically.`
              : 'Journeys pointing at it are repaired automatically.'}
          </span>
        </form>
      </div>
    </>
  );
}

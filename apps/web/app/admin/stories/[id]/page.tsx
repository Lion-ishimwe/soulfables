import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStory, listAuthorOptions, listShelfOptions, isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice } from '@/components/admin/ui';
import { StoryForm } from '@/components/admin/story-form';
import { deleteStory } from '@/app/actions/stories';

export const metadata: Metadata = { title: 'Edit story' };
export const dynamic = 'force-dynamic';

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [story, authors, shelves] = await Promise.all([
    getStory(id),
    listAuthorOptions(),
    listShelfOptions(),
  ]);

  if (!story) notFound();

  return (
    <>
      <PageHeader
        title={story.title}
        subtitle={story.status === 'published' ? 'Live on the public site.' : 'Not yet visible to readers.'}
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        {story.status === 'published' && (
          <Link
            href={`/story/${story.slug}`}
            className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            View on site ↗
          </Link>
        )}
      </div>

      {isReadOnly() && <ReadOnlyNotice />}

      <StoryForm draft={story} authors={authors} shelves={shelves} />

      <div className="mt-12 border-t border-rule pt-6">
        <p className="sf-eyebrow mb-3">Danger</p>
        <form action={deleteStory} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="id" value={story.id} />
          <button
            type="submit"
            className="border border-state-danger/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-state-danger transition-colors hover:bg-state-danger hover:text-ink"
          >
            Delete this story
          </button>
          <span className="text-xs text-grey-muted">
            Permanent. Reader bookmarks and journal links to it are removed too.
          </span>
        </form>
      </div>
    </>
  );
}

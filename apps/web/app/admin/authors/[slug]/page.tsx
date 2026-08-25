import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAdminAuthor } from '@/lib/admin-data';
import { PageHeader } from '@/components/admin/ui';
import { AuthorForm } from '@/components/admin/author-form';
import { deleteAuthor } from '@/app/actions/editorial';

export const metadata: Metadata = { title: 'Edit author' };
export const dynamic = 'force-dynamic';

export default async function EditAuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const author = await getAdminAuthor(slug);
  if (!author) notFound();

  return (
    <>
      <PageHeader
        title={author.name}
        subtitle={
          author.isPersona
            ? 'A voice of the House, not a person.'
            : `${author.storyCount} ${author.storyCount === 1 ? 'story' : 'stories'} carry this byline`
        }
      />

      <AuthorForm draft={author} />

      <div className="mt-12 border-t border-rule pt-6">
        <p className="sf-eyebrow mb-3">Danger</p>
        <form action={deleteAuthor} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="slug" value={author.slug} />
          <button
            type="submit"
            className="border border-state-danger/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-state-danger transition-colors hover:bg-state-danger hover:text-ink"
          >
            Remove this author
          </button>
          <span className="max-w-lg text-xs leading-normal text-grey-muted">
            {author.storyCount > 0
              ? `${author.storyCount} stories keep their place and simply lose the byline. Nothing is unpublished.`
              : 'Nothing else is affected.'}
          </span>
        </form>
      </div>
    </>
  );
}

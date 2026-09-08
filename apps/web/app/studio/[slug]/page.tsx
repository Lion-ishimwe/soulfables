import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireViewer, isStaff } from '@/lib/auth';
import { accountForEmail, getWorkStory } from '@/lib/admin-data';
import { StatusPill } from '@/components/admin/ui';
import { StudioEditor } from '@/components/studio/studio-editor';
import { AskAI } from '@/components/studio/ask-ai';

export const metadata: Metadata = {
  title: 'Writing',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StudioStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await requireViewer(`/studio/${slug}`);
  const [story, account] = await Promise.all([
    getWorkStory(slug),
    accountForEmail(viewer.email),
  ]);

  if (!story) notFound();

  const staff = isStaff(viewer.role);
  const mine =
    account &&
    (story.assignedAuthorSlug === account.authorSlug ||
      story.authorSlug === account.authorSlug);

  // Not staff, not yours: this is not your desk.
  if (!staff && !mine) redirect('/studio');

  const handedOn =
    story.assignedAuthorSlug &&
    story.authorSlug &&
    story.assignedAuthorSlug !== story.authorSlug;

  return (
    <div className="mx-auto max-w-page px-5 py-16 sm:px-8">
      <nav aria-label="Breadcrumb" className="mb-8">
        <Link
          href="/studio"
          className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory"
        >
          ← The Writing Room
        </Link>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-light text-ivory">
            {story.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-3 font-ui text-xs text-grey-muted">
            <span>{story.shelfLabel ?? 'No shelf'}</span>
            <span>
              {story.releaseMode === 'serial'
                ? `Serial · ${story.chapters.length} chapters`
                : 'One whole story'}
            </span>
            {handedOn && <span>Begun by {story.authorName}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <AskAI storySlug={story.slug} storyTitle={story.title} />
          <StatusPill status={story.status} />
        </div>
      </header>

      {/* What the House said when it came back. */}
      {story.revisionNote && story.status === 'draft' && (
        <div className="mb-8 border-l-2 border-gold bg-gold-dim px-6 py-5">
          <p className="sf-eyebrow mb-2">A note from the House</p>
          <p className="font-reading text-base leading-relaxed text-ivory">
            {story.revisionNote}
          </p>
        </div>
      )}

      {story.status === 'in_review' && (
        <div className="mb-8 border border-rule px-6 py-5">
          <p className="sf-eyebrow mb-2">With the House</p>
          <p className="text-sm leading-normal text-grey">
            Sent in and waiting to be read. You can still make changes — they
            will be read as they stand when someone opens it.
          </p>
        </div>
      )}

      {story.status === 'published' && (
        <div className="mb-8 border border-rule px-6 py-5">
          <p className="sf-eyebrow mb-2 text-state-success">Published</p>
          <p className="text-sm leading-normal text-grey">
            It is in the library.{' '}
            <Link
              href={`/story/${story.slug}`}
              className="text-gold transition-colors hover:text-gold-soft"
            >
              Read it as everyone else does
            </Link>
            .
          </p>
        </div>
      )}

      <StudioEditor story={story} canPublish={staff} />
    </div>
  );
}

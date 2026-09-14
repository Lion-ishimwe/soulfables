import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getWorkStory,
  listAdminAuthors,
  listAdminShelves,
  listThemes,
  storyThemeIds,
} from '@/lib/admin-data';
import { PageHeader, StatusPill } from '@/components/admin/ui';
import { StoryForm } from '@/components/admin/story-form';
import { AudioField } from '@/components/admin/audio-field';
import { getStoryNarration } from '@/lib/admin-data';
import { VOICES, defaultVoice } from '@/lib/audio/tts';
import { ReviewPanel } from '@/components/admin/review-panel';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { discardStory, approveStory } from '@/app/actions/workflow';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Edit story' };
export const dynamic = 'force-dynamic';

/*
 * The staff view of one story.
 *
 * Everything an author sees, plus the things only the House decides:
 * shelf, access, and whether it goes out. A story waiting to be read
 * carries its review controls at the top, because that is what someone
 * opening it from the queue came to do.
 */
export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [story, authors, shelves, themes, themeIds] = await Promise.all([
    getWorkStory(slug),
    listAdminAuthors(),
    listAdminShelves(),
    listThemes(),
    storyThemeIds(slug),
  ]);

  if (!story) notFound();

  const handedOn =
    story.assignedAuthorSlug &&
    story.authorSlug &&
    story.assignedAuthorSlug !== story.authorSlug;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={story.title}
          subtitle={
            story.status === 'published'
              ? `Published ${formatDate(story.publishedAt)}`
              : story.status === 'in_review'
                ? `Sent in ${formatDate(story.submittedAt)} — waiting to be read`
                : 'Not visible to readers.'
          }
        />

        <div className="flex items-center gap-3 pt-2">
          <StatusPill status={story.status} />
          <KebabMenu
            label={story.title}
            items={[
              {
                kind: 'link',
                label: 'Open in the studio',
                href: `/studio/${story.slug}` as never,
              },
              ...(story.status === 'published'
                ? [
                    {
                      kind: 'link' as const,
                      label: 'View on site',
                      href: `/story/${story.slug}` as never,
                    },
                  ]
                : []),
              ...(story.status === 'in_review'
                ? [
                    {
                      kind: 'action' as const,
                      label: 'Approve and publish',
                      action: approveStory,
                      fields: { slug: story.slug },
                    },
                  ]
                : []),
              {
                kind: 'action',
                label: 'Delete story',
                action: discardStory,
                fields: { slug: story.slug },
                danger: true,
                confirm: `Delete “${story.title}”?`,
                confirmBody:
                  'The story, its chapters and everything readers saved against it go with it. This cannot be undone.',
                confirmWord: 'delete',
              },
            ]}
          />
        </div>
      </div>

      {/* Whoever is carrying it now. */}
      {handedOn && (
        <p className="mb-6 border-l-2 border-gold bg-gold-dim px-5 py-3 text-sm text-ivory">
          Begun by {story.authorName}, now with {story.assignedName}. The
          byline stays with whoever started it.
        </p>
      )}

      {/* Waiting to be read — decide here rather than going back. */}
      {story.status === 'in_review' && (
        <div className="mb-8 border border-gold/25 bg-gold-dim p-6">
          <p className="sf-eyebrow mb-4">Waiting on the House</p>
          <ReviewPanel slug={story.slug} title={story.title} />
        </div>
      )}

      {story.revisionNote && story.status === 'draft' && (
        <div className="mb-8 border-l-2 border-rule-strong px-5 py-3">
          <p className="sf-eyebrow mb-1.5">Sent back with</p>
          <p className="text-sm leading-normal text-grey">{story.revisionNote}</p>
        </div>
      )}

      <StoryForm
        draft={{
          id: story.slug,
          title: story.title,
          slug: story.slug,
          subtitle: story.subtitle,
          excerpt: story.excerpt,
          bodyMdx: story.bodyMdx,
          authorId: story.authorSlug,
          shelfId: story.shelfSlug,
          access: story.access,
          status: story.status,
          coverImage: story.coverImage,
          releaseMode: story.releaseMode,
          themeIds,
        }}
        authors={authors.map((a) => ({ value: a.slug, label: a.name }))}
        shelves={shelves.map((s) => ({ value: s.slug, label: s.label }))}
        themes={themes.map((t) => ({ value: t.id, label: t.label }))}
      />

      <AudioField
        storySlug={story.slug}
        narration={await getStoryNarration(story.slug)}
        voices={VOICES.map((v) => ({ id: v.id, label: v.label }))}
        defaultVoice={defaultVoice()}
        words={
          (story.releaseMode === 'serial'
            ? story.chapters.map((c) => c.bodyMdx).join(' ')
            : story.bodyMdx
          )
            .trim()
            .split(/\s+/)
            .filter(Boolean).length
        }
      />

      {story.releaseMode === 'serial' && (
        <section className="mt-12 border-t border-rule pt-8">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="sf-eyebrow">Chapters</h2>
            <Link
              href={`/studio/${story.slug}`}
              className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
            >
              Edit chapters in the studio →
            </Link>
          </div>

          {story.chapters.length === 0 ? (
            <p className="border border-rule px-6 py-5 text-sm text-grey-muted">
              A serial with no chapters yet.
            </p>
          ) : (
            <ul className="divide-y divide-rule border border-rule">
              {story.chapters.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-ivory">
                    <span className="font-mono text-xs text-gold">
                      {String(c.number).padStart(2, '0')}
                    </span>{' '}
                    {c.title}
                  </span>
                  <StatusPill status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

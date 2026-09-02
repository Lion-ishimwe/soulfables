import Link from 'next/link';
import type { Route } from 'next';
import type { WorkStory } from '@/lib/admin-data';
import { Cover } from '@/components/cover-art';
import { ThemeChips } from '@/components/theme-chips';
import { StatusPill } from '@/components/admin/ui';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { formatCount, formatDate } from '@/lib/format';

/**
 * A story as the House sees it.
 *
 * The same shape as the reader's card, carrying different facts. A reader
 * wants to know what a story is about; an editor wants to know what state
 * it is in, who is holding it, and whether anybody has read it — so the
 * status pill is the first thing on the card and the byline sits next to
 * whoever is actually writing it when those differ.
 *
 * No full-card link overlay, unlike the public tile. A card with a menu
 * on it needs two targets, and an overlay would swallow the menu.
 */
export function AdminStoryTile({
  story,
  items,
}: {
  story: WorkStory;
  items: React.ComponentProps<typeof KebabMenu>['items'];
}) {
  const handedOn =
    story.assignedAuthorSlug && story.assignedAuthorSlug !== story.authorSlug;

  return (
    <article className="flex h-full flex-col rounded-lg border border-rule bg-ink-raised transition-colors duration-base ease-house hover:border-rule-strong">
      <div className="flex gap-4 p-4">
        <Link
          href={`/admin/stories/${story.slug}` as Route}
          tabIndex={-1}
          aria-hidden="true"
          className="group relative aspect-[2/3] w-[72px] shrink-0 overflow-hidden rounded bg-ink"
        >
          <Cover
            src={story.coverImage}
            title={story.title}
            author={story.authorName ?? undefined}
            shelf={story.shelfSlug}
            className="transition-transform duration-slow ease-house group-hover:scale-[1.04]"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={story.status} />
              {story.revisionNote && story.status === 'draft' && (
                <span
                  title={story.revisionNote}
                  className="whitespace-nowrap border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold"
                >
                  Sent back
                </span>
              )}
            </span>
            <span className="-mr-1 -mt-1 shrink-0">
              <KebabMenu label={story.title} items={items} />
            </span>
          </div>

          <h3 className="mt-2.5 font-display text-lg font-light leading-snug text-ivory">
            <Link
              href={`/admin/stories/${story.slug}` as Route}
              className="transition-colors hover:text-gold"
            >
              {story.title}
            </Link>
          </h3>

          <p className="mt-1.5 font-ui text-xs text-grey-muted">
            {story.authorName ?? 'No byline'}
            {handedOn && (
              <>
                {' · '}
                <span className="text-gold" title="Whoever is writing it now">
                  with {story.assignedName}
                </span>
              </>
            )}
          </p>

          <ThemeChips themes={story.themes} className="mt-3" />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-rule px-4 py-2.5 font-ui text-xs text-grey-muted">
        <span>☕ {story.readingMinutes} min</span>

        {story.releaseMode === 'serial' ? (
          <span className="tabular-nums">
            ▤ {story.chapters.filter((c) => c.status === 'published').length}/
            {story.chapters.length} chapters
          </span>
        ) : (
          <span>▤ Whole</span>
        )}

        {/* Zero opens is worth saying here, unlike on the reader's card —
            "nobody has opened this" is exactly the thing an editor is
            looking at this page to find out. */}
        <span className="tabular-nums">👁 {formatCount(story.views)}</span>

        <span className="ml-auto whitespace-nowrap text-grey-faint">
          {formatDate(story.updatedAt ?? story.publishedAt ?? story.submittedAt)}
        </span>
      </div>
    </article>
  );
}

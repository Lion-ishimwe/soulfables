import Link from 'next/link';
import type { StoryCard as StoryCardType } from '@/lib/content';
import { Cover } from '@/components/cover-art';
import { ThemeChips } from '@/components/theme-chips';
import { formatCount } from '@/lib/format';

/**
 * A story on the Library shelf.
 *
 * The cover is small and to the side rather than large and on top. That
 * is the whole difference from the card used on a shelf page, and it is
 * deliberate: a shelf page is a room you have chosen to stand in and can
 * afford big covers, whereas the Library is a list you are scanning, and
 * on a list the title has to win.
 *
 * No bookmark button, though the reference shows one. The Library is
 * cached for everybody at once — that is what makes it fast — and "have
 * I saved this?" is a different answer for every reader. Rendering the
 * icon anyway would give the House a bookmark that does not bookmark;
 * saving lives on the story itself, where the page is already the
 * reader's own.
 */
export function StoryTile({
  story,
  compact = false,
}: {
  story: StoryCardType;
  compact?: boolean;
}) {
  const views = story.views ?? 0;

  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-rule bg-ink-raised transition-all duration-base ease-house hover:border-rule-strong hover:bg-ink-hover">
      <div className={`flex gap-4 ${compact ? 'p-3.5' : 'p-4'}`}>
        <div className="relative aspect-[2/3] w-[76px] shrink-0 overflow-hidden rounded bg-ink sm:w-[86px]">
          <Cover
            src={story.coverImage}
            title={story.title}
            author={story.author}
            shelf={story.shelf}
            className="transition-transform duration-slow ease-house group-hover:scale-[1.04]"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex flex-wrap items-center gap-2 font-ui text-xs text-grey-muted">
            <span>☕ {story.readingMinutes} min</span>
            {story.access === 'premium' && (
              <span className="border border-gold/45 px-1.5 py-px font-ui text-micro uppercase tracking-[0.12em] text-gold">
                Residents
              </span>
            )}
            {story.hasAudio && (
              <span title={story.audioMinutes ? `Narrated, ${story.audioMinutes} minutes` : 'Narrated'}>
                ♪{story.audioMinutes ? ` ${story.audioMinutes} min` : ''}
              </span>
            )}
          </p>

          <h3 className="mt-1.5 font-display text-lg font-light leading-snug text-ivory transition-colors duration-base group-hover:text-gold">
            {/* The link covers the card. One target, and the whole tile
                takes the hover, rather than a title you have to hit. */}
            <Link href={`/story/${story.slug}`} className="before:absolute before:inset-0">
              {story.title}
            </Link>
          </h3>

          <p className="mt-1.5 font-ui text-xs text-grey-muted">{story.author}</p>

          <ThemeChips themes={story.themes} className="mt-3" />
        </div>
      </div>

      {/*
        Only when there is something true to report. Every story starts at
        nought, and a row of cards each announcing "0" reads as a broken
        page rather than as a new House.
      */}
      {views > 0 && (
        <div className="mt-auto flex items-center gap-4 border-t border-rule px-4 py-2.5 font-ui text-xs text-grey-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true">👁</span>
            <span className="tabular-nums">{formatCount(views)}</span>
            <span className="sr-only">opens</span>
          </span>
        </div>
      )}
    </article>
  );
}

/**
 * The same story, as a line rather than a card.
 *
 * The list view exists for the reader who knows roughly what they are
 * after and wants to run their eye down forty titles. It carries the
 * subtitle, which the card cannot afford the room for, and drops the
 * cover to a thumbnail.
 */
export function StoryListRow({ story }: { story: StoryCardType }) {
  const views = story.views ?? 0;

  return (
    <article className="group relative flex items-start gap-4 px-4 py-4 transition-colors hover:bg-ink-hover sm:gap-5 sm:px-5">
      <div className="relative aspect-[2/3] w-12 shrink-0 overflow-hidden rounded bg-ink sm:w-14">
        <Cover
          src={story.coverImage}
          title={story.title}
          author={story.author}
          shelf={story.shelf}
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-light leading-snug text-ivory transition-colors group-hover:text-gold">
          <Link href={`/story/${story.slug}`} className="before:absolute before:inset-0">
            {story.title}
          </Link>
        </h3>

        {story.subtitle && (
          <p className="mt-1 line-clamp-2 text-sm leading-normal text-grey-muted">
            {story.subtitle}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-ui text-xs text-grey-muted">
          <span>{story.author}</span>
          <span>☕ {story.readingMinutes} min</span>
          {story.access === 'premium' && <span className="text-gold">Residents</span>}
          {views > 0 && (
            <span className="tabular-nums">👁 {formatCount(views)}</span>
          )}
          <ThemeChips themes={story.themes} />
        </div>
      </div>
    </article>
  );
}

import Link from 'next/link';
import type { StoryCard as StoryCardType } from '@/lib/content';
import { Cover } from './cover-art';

/**
 * The story card, as it appears in the library and on shelves.
 *
 * The cover leads now, then reading time — because the question a reader
 * is actually asking is "what is this, and do I have time for it right
 * now?", in that order.
 *
 * Covers are 2:3, the proportion of a book rather than of a browser
 * window. That is the whole point of the House.
 */
export function StoryCard({ story }: { story: StoryCardType }) {
  return (
    <Link
      href={`/story/${story.slug}`}
      className="group flex h-full flex-col bg-ink transition-colors duration-base ease-house hover:bg-ink-raised"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink-raised">
        <Cover
          src={story.coverImage}
          title={story.title}
          author={story.author}
          shelf={story.shelf}
          className="transition-transform duration-slow ease-house group-hover:scale-[1.03]"
        />

        {/* Badges sit on the cover, where a bookshop puts its stickers. */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {story.access === 'premium' && (
            <span className="border border-gold/50 bg-ink/80 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold backdrop-blur-sm">
              Residents
            </span>
          )}
          {story.hasAudio && (
            <span
              className="border border-rule bg-ink/80 px-2 py-0.5 font-ui text-micro text-grey backdrop-blur-sm"
              title={story.audioMinutes ? `Narrated, ${story.audioMinutes} minutes` : 'Narrated'}
            >
              ♪ {story.audioMinutes ? `${story.audioMinutes} min` : 'Narrated'}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="font-ui text-xs text-grey-muted">
          ☕ {story.readingMinutes} min
        </p>

        <h3 className="mt-2 font-display text-xl font-light leading-snug text-ivory transition-colors duration-base group-hover:text-gold">
          {story.title}
        </h3>

        <p className="mt-2 flex-1 text-sm leading-normal text-grey-muted">
          {story.subtitle}
        </p>

        <p className="mt-5 font-ui text-xs text-grey-muted">{story.author}</p>
      </div>
    </Link>
  );
}

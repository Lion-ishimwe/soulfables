import Link from 'next/link';
import type { StoryCard as StoryCardType } from '@/lib/content';

/**
 * The story card, as it appears in the library and on shelves.
 *
 * Reading time leads, deliberately: on the live site every card opens
 * with "11 min", because the question a reader is actually asking is
 * "do I have time for this right now?"
 */
export function StoryCard({ story }: { story: StoryCardType }) {
  return (
    <Link
      href={`/story/${story.slug}`}
      className="group flex h-full flex-col bg-ink p-8 transition-colors duration-base ease-house hover:bg-ink-raised"
    >
      <p className="font-ui text-sm text-grey-muted">
        ☕ {story.readingMinutes} min
        {story.access === 'premium' && (
          <span className="ml-3 text-gold" title="For Residents">
            ✦
          </span>
        )}
      </p>

      <h3 className="mt-4 font-display text-2xl font-light leading-snug text-ivory transition-colors duration-base group-hover:text-gold">
        {story.title}
      </h3>

      <p className="mt-3 flex-1 text-sm leading-normal text-grey-muted">
        {story.subtitle}
      </p>

      <p className="mt-6 font-ui text-xs text-grey-muted">{story.author}</p>

      <span className="sf-eyebrow mt-4 text-gold/70 transition-colors duration-base group-hover:text-gold">
        Read the story
      </span>
    </Link>
  );
}

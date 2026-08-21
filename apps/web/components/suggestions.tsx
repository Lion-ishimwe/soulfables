import Link from 'next/link';
import { getRecommendations } from '@/lib/recommendations';

/**
 * The Librarian's suggestions.
 *
 * Split out of the home page so it can stream. Recommendations are the
 * only per-reader thing on the front door, and they were making the whole
 * page wait — greeting, shelves and all — on a session lookup plus a
 * reading history. Now the House renders immediately and this fills in
 * underneath it.
 */
export async function Suggestions({ limit = 3 }: { limit?: number }) {
  const recommendations = await getRecommendations(limit);
  if (recommendations.length === 0) return null;

  return (
    <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
      <p className="sf-eyebrow mb-8 text-center">The Librarian suggests</p>
      <ul className="grid gap-px bg-rule sm:grid-cols-3">
        {recommendations.map(({ story, reason }) => (
          <li key={story.slug}>
            <Link
              href={`/story/${story.slug}`}
              className="group flex h-full flex-col bg-ink p-8 transition-colors duration-base ease-house hover:bg-ink-raised"
            >
              <p className="flex items-center gap-3 font-ui text-xs text-grey-muted">
                <span>☕ {story.readingMinutes} min</span>
                {story.hasAudio && <span aria-label="Narrated">♪</span>}
              </p>
              <h3 className="mt-3 font-display text-2xl font-light text-ivory transition-colors duration-base group-hover:text-gold">
                {story.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-normal text-grey-muted">
                {story.subtitle}
              </p>
              {/* Every suggestion says why it was made. */}
              <p className="mt-5 border-t border-rule pt-4 font-ui text-xs italic text-gold/80">
                {reason}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Holds the same space while the suggestions resolve, so nothing jumps. */
export function SuggestionsSkeleton() {
  return (
    <section className="mx-auto max-w-page px-5 pb-24 sm:px-8" aria-hidden="true">
      <p className="sf-eyebrow mb-8 text-center">The Librarian suggests</p>
      <ul className="grid gap-px bg-rule sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="bg-ink p-8">
            <div className="h-3 w-16 bg-rule" />
            <div className="mt-5 h-6 w-3/4 bg-rule" />
            <div className="mt-3 h-3 w-full bg-rule" />
            <div className="mt-2 h-3 w-2/3 bg-rule" />
            <div className="mt-8 h-3 w-1/2 bg-rule" />
          </li>
        ))}
      </ul>
    </section>
  );
}

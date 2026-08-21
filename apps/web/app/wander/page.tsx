import type { Metadata } from 'next';
import Link from 'next/link';
import { getWanderStory, getShelves } from '@/lib/content';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = {
  title: 'Wander',
  description:
    'Let the Librarian choose. One story, picked for the hour you are in.',
  alternates: { canonical: '/wander' },
};

// Changes on the hour, with the story.
export const revalidate = 3600;

/*
 * Wander.
 *
 * The live site returns a 404 here. The idea the nav implies is that you
 * arrive without a destination and are handed something — so that is what
 * this does. The choice is deterministic per hour rather than random per
 * load: being handed a story should feel considered, not like pulling a
 * lever.
 */
export default async function WanderPage() {
  const [story, shelves] = await Promise.all([getWanderStory(), getShelves()]);

  if (!story) {
    return (
      <QuietPage
        eyebrow="NO DESTINATION"
        title="The shelves are still being filled."
        body="The Librarian has nothing to hand you yet. Come back when there are stories to wander into."
      />
    );
  }

  const shelf = shelves.find((s) => s.slug === story.shelf);

  return (
    <section className="mx-auto max-w-content px-5 py-24 text-center sm:px-8 sm:py-32">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-6">The Librarian chose this for you</p>

      <h1 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
        {story.title}
      </h1>

      <p className="mx-auto mt-5 max-w-measure font-display text-xl italic leading-snug text-grey">
        {story.subtitle}
      </p>

      <p className="mt-8 font-ui text-sm text-grey-muted">
        {shelf && (
          <>
            {shelf.emoji} {shelf.label} ·{' '}
          </>
        )}
        ☕ {story.readingMinutes} min · By {story.author}
      </p>

      <Link
        href={`/story/${story.slug}`}
        className="mt-10 inline-block border border-gold/50 px-10 py-4 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
      >
        Begin reading
      </Link>

      <p className="mt-12 text-xs text-grey-muted">
        A different story waits here each hour.
      </p>
    </section>
  );
}

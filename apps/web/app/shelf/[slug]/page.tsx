import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getShelf, getShelves, getStories, getJourney } from '@/lib/content';
import { StoryCard } from '@/components/story-card';
import { getFeatured } from '@/lib/featured';

/*
 * A shelf page.
 *
 * This is the surface that makes Soulfables not-a-blog, so it is worth
 * being explicit about what it does that a category archive does not:
 *
 *   - It opens with a Librarian's note that actively points elsewhere.
 *     A category page tries to keep you; a shelf tells you where readers
 *     usually go next, and trusts you to go.
 *   - It has an entry story ("BEGIN HERE") chosen for newcomers.
 *   - It renders the journey graph — where readers arrive from and where
 *     they continue to. Editorial today, behavioural later, same UI.
 *
 * All three are data, not copy in a template, so the House can change any
 * of it from the admin dashboard.
 */

export const revalidate = 300;

export async function generateStaticParams() {
  const shelves = await getShelves();
  return shelves.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shelf = await getShelf(slug);
  if (!shelf) return { title: 'Shelf not found' };

  return {
    title: shelf.title,
    description: shelf.tagline,
    alternates: { canonical: `/shelf/${shelf.slug}` },
    openGraph: {
      title: `${shelf.title} · Soulfables`,
      description: shelf.tagline,
      url: `/shelf/${shelf.slug}`,
      type: 'website',
    },
  };
}

export default async function ShelfPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const shelf = await getShelf(slug);
  if (!shelf) notFound();

  const [stories, journey, spotlights] = await Promise.all([
    getStories(slug),
    getJourney(slug),
    getFeatured('shelf_spotlight'),
  ]);

  // Only a spotlight placed on THIS shelf, or on a story that lives here.
  const spotlight = spotlights.find(
    (s) => s.slug === slug || s.shelf === slug,
  );

  const [entry, ...rest] = stories;

  return (
    <>
      <nav aria-label="Breadcrumb" className="mx-auto max-w-page px-5 pt-10 sm:px-8">
        <Link
          href="/shelves"
          className="font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
        >
          ← All Shelves
        </Link>
      </nav>

      {/* Header */}
      <header className="mx-auto max-w-content px-5 pb-16 pt-12 text-center sm:px-8">
        <p className="text-3xl" aria-hidden="true">
          {shelf.emoji}
        </p>
        <p className="sf-eyebrow mt-6">The Library of Feelings</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          {shelf.title}
        </h1>
        <p className="mx-auto mt-5 max-w-measure font-display text-xl italic text-grey-muted">
          {shelf.tagline}
        </p>

        <p className="mt-8 font-ui text-sm text-grey-muted">
          {stories.length === 0
            ? 'This shelf is still being filled'
            : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} waiting`}
          {stories.length > 0 && (
            <>
              {' · '}
              Most stay about{' '}
              {Math.round(
                stories.reduce((n, s) => n + s.readingMinutes, 0) / stories.length,
              )}{' '}
              minutes
            </>
          )}
        </p>
      </header>

      {/* The Librarian's note */}
      {shelf.librarianNote && (
        <aside className="mx-auto max-w-content px-5 pb-20 sm:px-8">
          <div className="border-l border-gold/40 py-2 pl-6 sm:pl-8">
            <p className="sf-eyebrow">A note from the Librarian</p>
            <blockquote className="mt-4 font-display text-2xl font-light italic leading-snug text-ivory">
              “{shelf.librarianNote}”
            </blockquote>
            <footer className="mt-4 font-ui text-sm text-grey-muted">
              — The Librarian
            </footer>
          </div>
        </aside>
      )}

      {/* A spotlight placed by the House, if there is one for this shelf. */}
      {spotlight && spotlight.slug !== entry?.slug && (
        <section className="mx-auto max-w-page px-5 pb-20 sm:px-8">
          <p className="sf-eyebrow mb-6">{spotlight.headline ?? 'Spotlight'}</p>
          <Link
            href={spotlight.href}
            className="group block border border-gold/25 bg-gold-dim p-8 transition-all duration-base ease-house hover:border-gold/40 sm:p-10"
          >
            <h2 className="font-display text-3xl font-light text-ivory transition-colors duration-base group-hover:text-gold">
              {spotlight.title}
            </h2>
            <p className="mt-3 max-w-measure font-display text-xl italic leading-snug text-grey">
              {spotlight.blurb ?? spotlight.subtitle}
            </p>
          </Link>
        </section>
      )}

      {/* Begin here */}
      {entry && (
        <section className="mx-auto max-w-page px-5 pb-20 sm:px-8">
          <p className="sf-eyebrow mb-6">Begin here</p>
          <Link
            href={`/story/${entry.slug}`}
            className="group block border border-rule p-8 transition-all duration-base ease-house hover:border-gold/30 hover:bg-ink-raised sm:p-12"
          >
            <h2 className="font-display text-3xl font-light text-ivory transition-colors duration-base group-hover:text-gold sm:text-4xl">
              {entry.title}
            </h2>
            <p className="mt-4 max-w-measure font-display text-xl italic leading-snug text-grey">
              {entry.subtitle}
            </p>
            <p className="mt-8 font-ui text-sm text-grey-muted">
              ☕ {entry.readingMinutes} min · By {entry.author}
            </p>
            <span className="mt-6 inline-block font-ui text-sm text-gold">
              Begin reading →
            </span>
          </Link>
        </section>
      )}

      {/* The rest of the shelf */}
      {rest.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <p className="sf-eyebrow mb-8">Also on this shelf</p>
          <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((story) => (
              <li key={story.slug}>
                <StoryCard story={story} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The journey */}
      {(journey.arrivesFrom.length > 0 || journey.continuesTo.length > 0) && (
        <section className="border-t border-rule">
          <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
            <p className="sf-eyebrow mb-10 text-center">The journey</p>
            <div className="grid gap-14 sm:grid-cols-2">
              {[
                { label: 'Readers usually come here from', shelves: journey.arrivesFrom },
                { label: 'Readers usually continue to', shelves: journey.continuesTo },
              ].map((group) =>
                group.shelves.length > 0 ? (
                  <div key={group.label} className="text-center">
                    <p className="font-ui text-sm text-grey-muted">{group.label}</p>
                    <ul className="mt-6 flex flex-wrap justify-center gap-3">
                      {group.shelves.map((s) => (
                        <li key={s.slug}>
                          <Link
                            href={`/shelf/${s.slug}`}
                            className="group flex items-center gap-2 rounded-full border border-rule px-4 py-2.5 transition-all duration-base ease-house hover:border-gold/40 hover:bg-gold-dim"
                          >
                            <span aria-hidden="true">{s.emoji}</span>
                            <span className="font-ui text-sm text-grey transition-colors group-hover:text-ivory">
                              {s.label}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

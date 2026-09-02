import type { Metadata } from 'next';
import Link from 'next/link';
import { getShelves, getStories } from '@/lib/content';
import { StoryCard } from '@/components/story-card';
import { getFeatured, applyOrder } from '@/lib/featured';

export const metadata: Metadata = {
  title: 'The Library',
  description:
    'Every Soulfables folktale, arranged by the feeling that brings people to it.',
  alternates: { canonical: '/library' },
};

export const revalidate = 300;

export default async function LibraryPage() {
  const [all, shelves, placed] = await Promise.all([
    getStories(),
    getShelves(),
    getFeatured('library_order'),
  ]);

  // Whatever the House put first comes first; everything else follows.
  const stories = applyOrder(all, placed);

  return (
    <>
      <header className="mx-auto max-w-content px-5 pb-14 pt-24 text-center sm:px-8">
        <p className="sf-eyebrow">The Library</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          All Stories
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          {stories.length} folktales across {shelves.length} shelves. Find the one
          that meets you where you are.
        </p>
      </header>

      {/* Shelf filter. Server-rendered links rather than client-side state,
          so every filtered view is its own indexable URL. */}
      <nav
        aria-label="Filter by shelf"
        className="mx-auto max-w-page px-5 pb-14 sm:px-8"
      >
        <ul className="flex flex-wrap justify-center gap-2.5">
          <li>
            <span className="inline-block rounded-full border border-gold/40 bg-gold-dim px-4 py-2 font-ui text-sm text-ivory">
              All
            </span>
          </li>
          {shelves.map((shelf) => (
            <li key={shelf.slug}>
              <Link
                href={`/shelf/${shelf.slug}`}
                className="inline-block rounded-full border border-rule px-4 py-2 font-ui text-sm text-grey-muted transition-all duration-base ease-house hover:border-gold/40 hover:text-ivory"
              >
                {shelf.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
        <p className="sf-eyebrow mb-8">
          {stories.length} {stories.length === 1 ? 'story' : 'stories'} found
        </p>
        <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <li key={story.slug}>
              <StoryCard story={story} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

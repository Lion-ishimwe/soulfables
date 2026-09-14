import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getShelves, getStories } from '@/lib/content';
import { ShelfGlyph } from '@/components/shelf-glyph';

export const metadata: Metadata = {
  title: 'All Shelves',
  description:
    'Every shelf in the House, arranged by the feeling that brings people to it.',
  alternates: { canonical: '/shelves' },
};

export const revalidate = 300;

/*
 * The Library of Feelings.
 *
 * This was a QuietPage — a title and a sentence, and no shelves on it —
 * while nine real shelves sat in the database and the Library, the footer
 * and the Library's own "Browse shelves" button all pointed here. Anyone
 * following that invitation arrived somewhere that did not answer it.
 *
 * A shelf is a place, so each one leads with its mark and says how many
 * stories are standing on it. Shelves with nothing on them are still
 * shown: an empty shelf is a room the House has built and not yet
 * furnished, and hiding it would make the Library look smaller than the
 * plan for it.
 */
export default async function ShelvesPage() {
  const [shelves, stories] = await Promise.all([getShelves(), getStories()]);

  const count = (slug: string) => stories.filter((s) => s.shelf === slug).length;

  return (
    <>
      <header className="mx-auto max-w-page px-5 pb-12 pt-16 sm:px-8 sm:pt-20">
        <p className="sf-eyebrow">The Library of Feelings</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          All Shelves
        </h1>
        <p className="mt-4 max-w-measure text-base leading-normal text-grey-muted">
          Every shelf in the House, arranged by the feeling that brings people
          to it. {shelves.length} shelves, {stories.length} stories.
        </p>
      </header>

      <section className="mx-auto max-w-page px-5 pb-20 sm:px-8">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((shelf) => {
            const n = count(shelf.slug);
            return (
              <li key={shelf.slug}>
                <Link
                  href={`/shelf/${shelf.slug}` as Route}
                  className="group flex h-full flex-col rounded-lg border border-rule bg-ink-raised p-6 transition-all duration-base ease-house hover:border-gold/40 hover:bg-ink-hover"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 text-gold">
                    <ShelfGlyph slug={shelf.slug} />
                  </span>

                  <h2 className="mt-4 font-display text-2xl font-light leading-snug text-ivory transition-colors group-hover:text-gold">
                    {shelf.label}
                  </h2>

                  <p className="mt-2.5 flex-1 text-sm leading-normal text-grey-muted">
                    {shelf.tagline}
                  </p>

                  <p className="mt-5 font-ui text-xs text-grey-faint">
                    {n === 0
                      ? 'Nothing on it yet'
                      : `${n} ${n === 1 ? 'story' : 'stories'}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mt-10 text-center font-ui text-sm text-grey-muted">
          Or{' '}
          <Link
            href={'/library' as Route}
            className="text-gold transition-colors hover:text-gold-soft"
          >
            read everything at once
          </Link>
          .
        </p>
      </section>
    </>
  );
}

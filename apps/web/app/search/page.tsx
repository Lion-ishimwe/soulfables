import type { Metadata } from 'next';
import Link from 'next/link';
import { searchStories } from '@/lib/content';
import { StoryCard } from '@/components/story-card';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every folktale in the House.',
  alternates: { canonical: '/search' },
};

export const dynamic = 'force-dynamic';

/*
 * Search.
 *
 * A GET form with the query in the URL, not client-side state: a search
 * result is a place you can link someone to, bookmark, or go back to.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const results = query ? await searchStories(query) : [];

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="sf-eyebrow">Find your way</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          Search the House
        </h1>

        <form method="GET" action="/search" className="mx-auto mt-9 max-w-md">
          <label htmlFor="q" className="sr-only">
            Search stories
          </label>
          <div className="flex items-center border border-rule bg-ink-raised focus-within:border-gold/50">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              autoFocus
              placeholder="a feeling, a title, a name"
              className="w-full bg-transparent px-5 py-3.5 font-ui text-base text-ivory outline-none placeholder:text-grey-faint"
            />
            <button
              type="submit"
              className="flex-none px-5 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-colors hover:text-gold-soft"
            >
              Search
            </button>
          </div>
        </form>
      </header>

      {query && (
        <section className="mt-14">
          <p className="sf-eyebrow mb-8 text-center">
            {results.length === 0
              ? `Nothing found for “${query}”`
              : `${results.length} ${results.length === 1 ? 'story' : 'stories'} for “${query}”`}
          </p>

          {results.length === 0 ? (
            <div className="mx-auto max-w-content border border-rule px-8 py-14 text-center">
              <p className="font-display text-2xl text-ivory">
                The shelves came up empty.
              </p>
              <p className="mx-auto mt-3 max-w-measure text-sm leading-normal text-grey-muted">
                Try a feeling rather than a phrase — heartbreak, healing,
                grief, hope. The House is arranged by how things feel.
              </p>
              <Link
                href="/library"
                className="mt-6 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
              >
                Browse everything
              </Link>
            </div>
          ) : (
            <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
              {results.map((s) => (
                <li key={s.slug}>
                  <StoryCard story={s} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

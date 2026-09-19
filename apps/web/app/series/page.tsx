import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getSeriesList } from '@/lib/series';

export const metadata: Metadata = {
  title: 'Series',
  description: 'Stories that belong together, read in order. Some are kept for Premium.',
};

export const revalidate = 60;

/** The shelf of series: what the House tells in more than one sitting. */
export default async function SeriesPage() {
  const series = await getSeriesList();

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The House</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">Series</h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Stories that belong together, told in more than one sitting. Some are kept for Premium.
        </p>
      </header>

      {series.length === 0 ? (
        <p className="mx-auto mt-16 max-w-measure text-center font-display text-xl italic text-grey-muted">
          Nothing in more than one part yet. The first series is being written.
        </p>
      ) : (
        <ul className="mt-14 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <li key={s.slug} className="bg-ink">
              <Link href={`/series/${s.slug}` as Route} className="block h-full p-8 transition-colors hover:bg-ink-raised">
                <p className="flex items-center gap-3 font-ui text-xs text-grey-muted">
                  <span>{s.episodes} {s.episodes === 1 ? 'episode' : 'episodes'}</span>
                  {s.access === 'premium' && (
                    <span className="border border-gold/45 px-1.5 py-px font-ui text-micro uppercase tracking-[0.12em] text-gold">Premium</span>
                  )}
                </p>
                <h2 className="mt-3 font-display text-2xl font-light text-ivory">{s.title}</h2>
                {s.description && <p className="mt-2 text-sm leading-normal text-grey-muted">{s.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

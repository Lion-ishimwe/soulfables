import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSeries, getSeriesList } from '@/lib/series';
import { getViewer, isStaff } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/membership';
import { StoryTile } from '@/components/library/story-tile';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = (await getSeriesList()).find((s) => s.slug === slug);
  return series ? { title: series.title, description: series.description ?? undefined } : { title: 'Series' };
}

/** One series: its episodes in order, and whether this reader may open them. */
export default async function SeriesDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [series, viewer] = await Promise.all([getSeries(slug), getViewer()]);
  if (!series) notFound();
  const premium = viewer ? isStaff(viewer.role) || (await hasPremiumAccess()) : false;
  const locked = series.access === 'premium' && !premium;

  return (
    <div className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-20">
      <Link href={'/series' as Route} className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory">
        ← All series
      </Link>
      <header className="mt-8 max-w-content">
        <p className="flex items-center gap-3 font-ui text-xs text-grey-muted">
          <span>{series.stories.length} {series.stories.length === 1 ? 'episode' : 'episodes'}</span>
          {series.access === 'premium' && (
            <span className="border border-gold/45 px-1.5 py-px font-ui text-micro uppercase tracking-[0.12em] text-gold">Premium</span>
          )}
        </p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">{series.title}</h1>
        {series.description && <p className="mt-4 max-w-measure text-base leading-normal text-grey-muted">{series.description}</p>}
      </header>

      {locked && (
        <div className="mt-8 flex max-w-content flex-wrap items-center justify-between gap-4 border border-gold/25 bg-gold-dim px-5 py-4">
          <p className="font-ui text-sm text-ivory">
            This series is kept for Premium. <span className="text-grey-muted">Every episode opens with it.</span>
          </p>
          <Link href={'/membership' as Route} className="font-ui text-xs uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-soft">
            See Premium →
          </Link>
        </div>
      )}

      {series.stories.length === 0 ? (
        <p className="mt-14 font-display text-xl italic text-grey-muted">The first episode is on its way.</p>
      ) : (
        <ol className="mt-12 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {series.stories.map((story) => (
            <li key={story.slug} className="relative bg-ink">
              <span className="absolute left-4 top-4 z-10 font-ui text-micro uppercase tracking-[0.16em] text-gold">
                Episode {story.series?.episode ?? '·'}
              </span>
              <StoryTile story={{ ...story, access: locked ? 'premium' : story.access }} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

import Link from 'next/link';
import { getFeaturedOne } from '@/lib/featured';
import { Cover } from './cover-art';

/**
 * The front door's featured slot.
 *
 * Renders nothing at all when no slot is placed, which is the normal
 * state — the page falls back to its own arrangement rather than showing
 * an empty frame. That is why this returns null instead of a placeholder.
 */
export async function FeaturedHero() {
  const item = await getFeaturedOne('home_hero');
  if (!item) return null;

  return (
    <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
      <article className="grid items-center gap-8 border border-rule p-7 sm:p-10 lg:grid-cols-[14rem_1fr] lg:gap-12">
        <div className="mx-auto aspect-[2/3] w-40 overflow-hidden shadow-cover lg:w-full">
          <Cover
            src={item.coverImage}
            title={item.title}
            author={item.author ?? item.subtitle}
            shelf={item.shelf}
            sizes="(min-width: 1024px) 14rem, 10rem"
          />
        </div>

        <div className="text-center lg:text-left">
          <p className="sf-eyebrow text-gold">
            {item.headline ?? 'The Librarian chose this for you today'}
          </p>

          <h2 className="mt-5 font-display text-3xl font-light leading-tight text-ivory sm:text-4xl">
            {item.title}
          </h2>

          <p className="mx-auto mt-4 max-w-measure font-display text-xl italic leading-snug text-grey lg:mx-0">
            {item.blurb ?? item.subtitle}
          </p>

          {item.entityType === 'story' && (
            <p className="mt-6 font-ui text-sm text-grey-muted">
              ☕ {item.readingMinutes} min
              {item.author && <> · By {item.author}</>}
              {item.hasAudio && <> · ♪ Narrated</>}
            </p>
          )}

          <Link
            href={item.href}
            className="mt-8 inline-block border border-gold/50 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
          >
            {item.entityType === 'product' ? 'See the book' : 'Begin reading'}
          </Link>
        </div>
      </article>
    </section>
  );
}

import Link from 'next/link';
import { getShelves } from '@/lib/content';
import { getRecommendations } from '@/lib/recommendations';
import { Greeting } from '@/components/greeting';

/*
 * The front door.
 *
 * The organising idea, carried over from the live site: a reader does not
 * arrive looking for a category. They arrive feeling something. So the
 * first question the House asks is "How is your heart today?" and the
 * primary navigation is a row of feelings, not a genre menu.
 */

// Recommendations are per-reader, so the front door renders on demand.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [shelves, recommendations] = await Promise.all([
    getShelves(),
    getRecommendations(3),
  ]);
  const entry = shelves.slice(0, 6);

  return (
    <>
      <section className="relative overflow-hidden">
        {/* The lamp. A single soft pool of gold behind the greeting — the
            one atmospheric flourish on the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(200,149,40,0.20) 0%, rgba(200,149,40,0.05) 45%, transparent 70%)',
          }}
        />

        <div className="relative mx-auto max-w-content px-5 py-28 text-center sm:px-8 sm:py-40">
          <Greeting />

          <h1 className="mt-4 animate-rise font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
            How is your heart today?
          </h1>

          <p className="sf-eyebrow mt-8">Modern folktales for the heart</p>

          <ul className="mx-auto mt-10 flex max-w-xl flex-wrap justify-center gap-3">
            {entry.map((shelf) => (
              <li key={shelf.slug}>
                <Link
                  href={`/shelf/${shelf.slug}`}
                  className="group flex items-center gap-2.5 rounded-full border border-rule px-5 py-3 transition-all duration-base ease-house hover:border-gold/40 hover:bg-gold-dim"
                >
                  <span aria-hidden="true" className="text-base">
                    {shelf.emoji}
                  </span>
                  <span className="font-ui text-sm text-grey transition-colors duration-base group-hover:text-ivory">
                    {shelf.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/library"
            className="mt-12 inline-block font-ui text-sm text-gold transition-colors duration-base ease-house hover:text-gold-soft"
          >
            Enter the full library →
          </Link>
        </div>
      </section>

      {/* Three doors. */}
      <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-3">
          {([
            { href: '/library', icon: '📖', title: 'Library', copy: 'Thirty-two folktales, arranged by feeling.' },
            { href: '/shop', icon: '🛍️', title: 'Shop', copy: 'Books, journals, and tools for every season.' },
            { href: '/letter', icon: '✉️', title: 'Weekly Letter', copy: 'A letter each week, from the shelves.' },
          ] as const).map((door) => (
            <Link
              key={door.href}
              href={door.href}
              className="group bg-ink p-10 transition-colors duration-base ease-house hover:bg-ink-raised"
            >
              <span aria-hidden="true" className="text-2xl">
                {door.icon}
              </span>
              <h2 className="mt-5 font-display text-2xl text-ivory">{door.title}</h2>
              <p className="mt-2 text-sm leading-normal text-grey-muted">{door.copy}</p>
            </Link>
          ))}
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <p className="sf-eyebrow mb-8 text-center">The Librarian suggests</p>
          <ul className="grid gap-px bg-rule sm:grid-cols-3">
            {recommendations.map(({ story, reason }) => (
              <li key={story.slug}>
                <Link
                  href={`/story/${story.slug}`}
                  className="group flex h-full flex-col bg-ink p-8 transition-colors duration-base ease-house hover:bg-ink-raised"
                >
                  <p className="font-ui text-xs text-grey-muted">
                    ☕ {story.readingMinutes} min
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
      )}

      <section className="px-5 pb-16 text-center sm:px-8">
        <p className="font-display text-3xl italic text-grey-muted sm:text-4xl">
          Every soul has a story.
        </p>
      </section>
    </>
  );
}

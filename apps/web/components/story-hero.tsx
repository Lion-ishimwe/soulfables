import Link from 'next/link';
import type { Route } from 'next';
import { Cover } from '@/components/cover-art';
import { ShelfGlyph } from '@/components/shelf-glyph';
import Image from 'next/image';

/**
 * The top of a story.
 *
 * When a story has real artwork, the artwork is the room: it is spread
 * across the whole width, softened, and let fall into the page's own
 * ground through a gradient, with the cover itself standing sharp in
 * front and the title beneath. A picture somebody chose for a story
 * deserves more than a postage stamp above the title — and a reader
 * arriving from the library should feel they have walked into it.
 *
 * The gradient ends in the ground colour, whichever palette the House
 * is wearing, so the hero belongs to the page rather than sitting on it.
 * The title always lands on solid ground: legibility is not left to the
 * picture.
 *
 * Without artwork, the drawn cover stays as it was — small, centred,
 * quiet — because the drawing is a placeholder and a placeholder blown
 * up to a hero is a hole made bigger.
 */
export function StoryHero({
  story,
  shelf,
  intro,
  after,
  href,
  authorHref,
}: {
  story: {
    title: string;
    subtitle: string;
    author: string;
    readingMinutes: number;
    coverImage?: string | null;
    shelf?: string | null;
  };
  shelf: { slug: string; label: string; emoji: string } | null;
  /** Something said before the shelf and title — Wander's "chosen for you". */
  intro?: React.ReactNode;
  /** Something after the byline — buttons, a reason, a way onward. */
  after?: React.ReactNode;
  /** When the hero is not on the story's own page: where the cover and title lead. */
  href?: string;
  /** The writer's page, when they have one. */
  authorHref?: string;
}) {
  const art = story.coverImage ?? null;

  const title = href ? (
    <Link href={href as Route} className="transition-colors duration-base ease-house hover:text-gold">
      {story.title}
    </Link>
  ) : (
    story.title
  );

  const heading = (
    <>
      {intro}
      {shelf && (
        <Link
          href={`/shelf/${shelf.slug}`}
          className="sf-eyebrow inline-flex items-center gap-2 transition-colors duration-base ease-house hover:text-gold"
        >
          <ShelfGlyph slug={shelf.slug} className="h-3.5 w-3.5 text-gold" />
          {shelf.label}
        </Link>
      )}
      <h1 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
        {title}
      </h1>
      <p className="mx-auto mt-5 max-w-measure font-display text-xl italic leading-snug text-grey-muted">
        {story.subtitle}
      </p>
      <p className="mt-8 font-ui text-sm text-grey-muted">
        By{' '}
        {authorHref ? (
          <Link href={authorHref as Route} className="text-grey transition-colors hover:text-gold">
            {story.author}
          </Link>
        ) : (
          story.author
        )}{' '}
        · ☕ {story.readingMinutes} min
      </p>
      {after}
    </>
  );

  const cover = (
    <Cover
      src={art}
      title={story.title}
      author={story.author}
      shelf={story.shelf}
      sizes={art ? '14rem' : '12rem'}
      priority={Boolean(art)}
    />
  );

  if (!art) {
    return (
      <header className="mx-auto max-w-content px-5 pb-14 pt-20 text-center sm:px-8">
        {href ? (
          <Link href={href as Route} className="mx-auto mb-10 block aspect-[2/3] w-40 overflow-hidden shadow-cover sm:w-48">
            {cover}
          </Link>
        ) : (
          <div className="mx-auto mb-10 aspect-[2/3] w-40 overflow-hidden shadow-cover sm:w-48">{cover}</div>
        )}
        {heading}
      </header>
    );
  }

  return (
    <header className="relative isolate overflow-hidden">
      {/*
        The room. The same picture, spread to the edges and softened
        until it is colour and light rather than a thing to look at —
        then the ground rises through it, so by the time the eye reaches
        the title there is only page.
      */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <Image
          src={art}
          alt=""
          fill
          sizes="100vw"
          quality={30}
          className="scale-110 object-cover opacity-80 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/70 via-55% to-ink" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="mx-auto max-w-content px-5 pb-14 pt-16 text-center sm:px-8 sm:pt-24">
        {href ? (
          <Link
            href={href as Route}
            className="mx-auto mb-10 block aspect-[2/3] w-44 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 transition-transform duration-slow ease-house hover:-translate-y-1.5 sm:w-56"
          >
            {cover}
          </Link>
        ) : (
          <div className="mx-auto mb-10 aspect-[2/3] w-44 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 sm:w-56">
            {cover}
          </div>
        )}
        {heading}
      </div>
    </header>
  );
}

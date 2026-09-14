import Link from 'next/link';
import Image from 'next/image';
import type { Route } from 'next';
import { getShelves, getStories, getProducts, getResidents } from '@/lib/content';
import { getBackdrop, getFeaturedOne } from '@/lib/featured';
import { Greeting } from '@/components/greeting';
import { LibraryBackdrop } from '@/components/library-backdrop';
import { Cover } from '@/components/cover-art';
import { Avatar } from '@/components/admin/avatar';
import { ShelfGlyph } from '@/components/shelf-glyph';
import { ProductCard } from '@/components/product-card';

/*
 * The lamp, as a reusable pool of light. The hero has one; nothing
 * below it did, and the one visual motif the House owns stopped at the
 * fold. It sits behind a section, never in front of anything.
 */
function Lamp({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl ${className}`}
      style={{
        background:
          'radial-gradient(ellipse at center, rgb(var(--c-gold) / 0.16) 0%, rgb(var(--c-gold) / 0) 70%)',
      }}
    />
  );
}

export const revalidate = 300;

/**
 * The front door.
 *
 * Arranged as a descent rather than a menu: a question, then the three
 * ways in, then one story chosen for today, then the shelves, then the
 * people, then the shop. Somebody who reads no further than the first
 * screen should still have somewhere to go.
 *
 * Every number on it is real. Shelf counts come from the published
 * stories, resident counts from the same list, and the featured story
 * from whatever the House placed in Settings → Featured — so a section
 * with nothing behind it does not render at all rather than showing a
 * frame around nothing.
 */
/*
 * The three doors' icons: an open book, a bag, an envelope. Line
 * drawings in currentColor, so they take the gold from the disc and
 * keep it in either palette. Emoji were here before, and an emoji is
 * whatever the reader's operating system thinks a shopping bag looks
 * like — a purple one, on most.
 */
const DOOR_ICONS = {
  book: (
    <>
      <path d="M12 6.5c-1.6-1.4-3.8-2-6.5-2H4v13h1.5c2.7 0 4.9.6 6.5 2 1.6-1.4 3.8-2 6.5-2H20v-13h-1.5c-2.7 0-4.9.6-6.5 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  bag: (
    <>
      <path d="M5.5 8.5h13l-.9 11.1a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4L5.5 8.5Z" />
      <path d="M8.75 8.5V7a3.25 3.25 0 0 1 6.5 0v1.5" />
    </>
  ),
  letter: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="1.5" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </>
  ),
} as const;

function DoorIcon({ name }: { name: keyof typeof DOOR_ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {DOOR_ICONS[name]}
    </svg>
  );
}

export default async function HomePage() {
  const [shelves, stories, products, residents, backdrop, featured] = await Promise.all([
    getShelves(),
    getStories(),
    getProducts(),
    getResidents(),
    getBackdrop(),
    getFeaturedOne('home_hero'),
  ]);

  /*
   * Counted here rather than carried on the shelf.
   *
   * Both lists are cached, so this costs nothing extra, and it keeps the
   * public Shelf type describing a shelf rather than a shelf plus a
   * statistic that only one page wants.
   */
  const storiesOn = (slug: string) => stories.filter((s) => s.shelf === slug).length;

  const feelings = shelves.slice(0, 6);
  const people = residents.slice(0, 3);
  const wares = products.slice(0, 4);

  const eyebrow = 'text-center font-ui text-micro uppercase tracking-[0.24em] text-grey-muted';

  return (
    <>
      {/* ---- The question ------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/*
          A chosen photograph if the House has set one, and the drawn
          library otherwise. Settings → Featured is where it changes; the
          drawn one is the default rather than a fallback for failure.
        */}
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-40"
            unoptimized
          />
        ) : (
          <LibraryBackdrop />
        )}

        {/* The lamp, sitting over the room. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(200,149,40,0.28) 0%, rgba(200,149,40,0) 70%)',
          }}
        />

        {/*
          The hero holds the screen.
          
          100svh rather than 100vh: on a phone, vh is measured against the
          viewport with the browser chrome hidden, so a full-height hero
          sits partly under the address bar until you scroll. svh is the
          small viewport — what you can actually see right now.
          
          Minus the 4rem header above it, so the two together are one
          screen rather than one screen plus a header.
        */}
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-page flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
          <Greeting />

          {/*
            The question is the heading, not the greeting.
            
            Greeting renders its own small italic line — wrapping it in an
            h1 gave the page a heading with no visible headline in it, and
            the front door lost the only sentence it was asking.
          */}
          <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-6xl">
            How is your heart today?
          </h1>

          <p className="mx-auto mt-6 max-w-measure font-ui text-base leading-relaxed text-grey sm:text-lg">
            Stories about love, loss, healing, identity, hope, and becoming.
          </p>

          {/*
            The shelves as the first thing you can touch. A reader who
            knows how they feel should not have to find a menu first.
          */}
          <ul className="mx-auto mt-9 flex max-w-2xl flex-wrap justify-center gap-3">
            {feelings.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/shelf/${s.slug}` as Route}
                  className="flex items-center gap-2.5 rounded-full border border-rule bg-ink/70 px-5 py-2.5 font-ui text-sm text-ivory backdrop-blur transition-colors hover:border-gold/50 hover:text-gold"
                >
                  <ShelfGlyph slug={s.slug} className="h-4 w-4 text-gold" />
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            <Link
              href={'/library' as Route}
              className="rounded border border-gold/60 px-7 py-3 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-colors hover:bg-gold hover:text-ink"
            >
              Enter the library
            </Link>
            <Link
              href={'/companion' as Route}
              className="font-ui text-sm text-grey transition-colors hover:text-ivory"
            >
              Meet the Librarian →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Three ways in ------------------------------------------ */}
      <section className="mx-auto max-w-page px-5 py-20 sm:px-8">
        <p className={eyebrow}>✦&nbsp;&nbsp;Enter the House&nbsp;&nbsp;✦</p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { href: '/library', title: 'Library', icon: 'book' as const, copy: `${shelves.length} shelves, arranged by feeling.` },
            { href: '/shop', title: 'Shop', icon: 'bag' as const, copy: 'Books, journals, and keepsakes for every season.' },
            { href: '/letter', title: 'Weekly Letter', icon: 'letter' as const, copy: 'A letter each week, from the shelves.' },
          ].map((d) => (
            <Link
              key={d.href}
              href={d.href as Route}
              className="group rounded-lg border border-rule bg-ink-raised p-6 transition-colors hover:border-gold/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 text-gold">
                <DoorIcon name={d.icon} />
              </span>
              <h2 className="mt-5 font-display text-2xl text-ivory">{d.title}</h2>
              <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">{d.copy}</p>
              <span className="mt-4 inline-block font-ui text-xs text-gold transition-colors group-hover:text-gold-soft">
                {d.title === 'Shop' ? 'Visit the shop' : d.title === 'Library' ? 'Explore stories' : 'Join the letter'} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---- Today's story ------------------------------------------ */}
      {/*
        The second most important thing on the page, and it looked like a
        form panel. Now it is the same room the story itself opens on:
        the cover's own art spread behind it and let fall into the ground,
        the cover sharp in front, the title large. An open band rather
        than a card, so the page breathes between the doors and the
        shelves.
      */}
      {featured && (
        <section className="relative isolate overflow-hidden border-y border-rule">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            {featured.coverImage ? (
              <Image
                src={featured.coverImage}
                alt=""
                fill
                sizes="100vw"
                quality={30}
                className="scale-110 object-cover opacity-50 blur-3xl"
              />
            ) : (
              <Lamp className="top-0 -translate-y-1/3" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
          </div>

          <article className="mx-auto grid max-w-page items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[15rem_1fr] lg:gap-14 lg:py-20">
            <Link
              href={featured.href as Route}
              className="group mx-auto block aspect-[2/3] w-44 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 transition-transform duration-slow ease-house hover:-translate-y-1.5 lg:w-full"
            >
              <Cover
                src={featured.coverImage}
                title={featured.title}
                author={featured.author ?? featured.subtitle}
                shelf={featured.shelf}
                sizes="(min-width: 1024px) 15rem, 11rem"
              />
            </Link>

            <div className="text-center lg:text-left">
              <p className="font-ui text-micro uppercase tracking-[0.24em] text-gold">
                {featured.headline ?? "Today's story from the House"}
              </p>

              <h2 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
                {featured.title}
              </h2>

              <p className="mx-auto mt-5 max-w-measure font-display text-xl italic leading-snug text-grey lg:mx-0">
                {featured.blurb ?? featured.subtitle}
              </p>

              <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 font-ui text-xs text-grey-muted lg:justify-start">
                {featured.readingMinutes ? <span>{featured.readingMinutes} min read</span> : null}
                {featured.author ? <><span aria-hidden="true">·</span><span>By {featured.author}</span></> : null}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
                <Link
                  href={featured.href as Route}
                  className="rounded bg-gold px-7 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90"
                >
                  Begin reading
                </Link>
                <Link
                  href={'/library' as Route}
                  className="font-ui text-sm text-grey transition-colors hover:text-ivory"
                >
                  Or browse the library →
                </Link>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* ---- The shelves -------------------------------------------- */}
      {/*
        The heart of the House, given the room it deserves: an open
        section under its own lamp, one shelf per feeling, each with its
        drawn glyph, its tagline, and an honest count. The hairline under
        each tile is the shelf's edge.
      */}
      <section className="relative mx-auto max-w-page px-5 py-20 sm:px-8">
        <Lamp className="top-0 -translate-y-1/2" />

        <div className="relative text-center">
          <p className={eyebrow}>✦&nbsp;&nbsp;Browse by feeling&nbsp;&nbsp;✦</p>
          <h2 className="mt-4 font-display text-3xl font-light text-ivory sm:text-4xl">
            Come in by the door that fits.
          </h2>
          <p className="mx-auto mt-3 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            Every shelf is a feeling. Choose the one you are carrying and the House will
            meet you there.
          </p>
        </div>

        <ul className="relative mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {shelves.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/shelf/${s.slug}` as Route}
                className="group flex h-full flex-col items-center rounded-lg border border-rule bg-ink-raised px-3 pb-5 pt-6 text-center transition-all duration-base ease-house hover:-translate-y-1 hover:border-gold/40 hover:shadow-cover"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold transition-colors duration-base group-hover:bg-gold/20">
                  <ShelfGlyph slug={s.slug} className="h-5 w-5" />
                </span>
                <span className="mt-4 font-display text-xl text-ivory">{s.label}</span>
                <span className="mt-1.5 line-clamp-2 font-ui text-xs leading-relaxed text-grey-muted">
                  {s.tagline}
                </span>
                {/*
                  A real count, from the published stories. A shelf with
                  nothing on it says so — the admin flags those too, and
                  the two should not disagree.
                */}
                <span className="mt-auto pt-4 font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                  {storiesOn(s.slug) === 0
                    ? 'Nothing yet'
                    : `${storiesOn(s.slug)} ${storiesOn(s.slug) === 1 ? 'story' : 'stories'}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- The people and the room -------------------------------- */}
      <section className="mx-auto max-w-page px-5 pb-20 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-rule bg-ink-raised p-6">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <p className="font-ui text-micro uppercase tracking-[0.2em] text-grey-muted">
                Meet the residents
              </p>
              <Link href={'/voices' as Route} className="font-ui text-xs text-gold hover:text-gold-soft">
                View all →
              </Link>
            </div>

            <ul className="grid gap-6 sm:grid-cols-3">
              {people.map((p) => (
                <li key={p.slug}>
                  <Link href={`/author/${p.slug}` as Route} className="group block">
                    <Avatar src={p.avatarUrl} name={p.name} isPersona={p.isPersona} size={64} />
                    <p className="mt-3 font-ui text-sm text-ivory transition-colors group-hover:text-gold">{p.name}</p>
                  </Link>
                  {p.isPersona && (
                    <p className="mt-1 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                      House voice
                    </p>
                  )}
                  <p className="mt-2 line-clamp-3 font-ui text-xs leading-relaxed text-grey-muted">
                    {p.bio ?? 'Writes for the House.'}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-rule bg-ink-raised p-6">
            <p className="font-ui text-micro uppercase tracking-[0.2em] text-grey-muted">
              The Reading Room
            </p>
            <p className="mt-4 max-w-prose font-ui text-sm leading-relaxed text-grey">
              A space to reflect, to keep what a story left behind, and to read what
              it left in somebody else.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                { href: '/journal', label: 'Reading Journal' },
                { href: '/residents', label: 'Reflections from readers' },
                { href: '/letter', label: 'The weekly letter' },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href as Route}
                    className="flex items-center gap-3 font-ui text-sm text-ivory transition-colors hover:text-gold"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded bg-gold/10 text-gold">
                      <span aria-hidden="true" className="text-xs">✦</span>
                    </span>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={'/journal' as Route}
              className="mt-6 inline-block font-ui text-xs text-gold transition-colors hover:text-gold-soft"
            >
              Enter the Reading Room →
            </Link>
          </div>
        </div>
      </section>

      {/* ---- The shop ----------------------------------------------- */}
      {wares.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <p className={`${eyebrow} text-left`}>✦&nbsp;&nbsp;From the House</p>
            <Link href={'/shop' as Route} className="font-ui text-xs text-gold hover:text-gold-soft">
              Shop all →
            </Link>
          </div>

          {/*
            Books, shown as books. The cover keeps its own proportions and
            stands whole on a lit shelf, rather than being cropped to fill
            a wide box — the old card cut the top off every title, and an
            uploaded cover fared worse. The shelf edge under the cover and
            the small lift on hover are the whole of the effect; a shop
            card should make you want to pick the thing up, not admire the
            card.
          */}
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {wares.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- The letter --------------------------------------------- */}
      {/*
        The last thing a visitor sees, so it should be an invitation
        rather than a grey box with a button in it: a quiet band under
        the lamp, one sentence, one door.

        A link rather than an inline form. There is no email provider
        connected yet, and a box that swallows an address without
        sending anything is worse than a door marked with where it goes.
      */}
      <section className="relative isolate overflow-hidden border-t border-rule">
        <Lamp className="bottom-0 translate-y-1/2" />
        <div className="relative mx-auto max-w-content px-5 py-20 text-center sm:px-8 sm:py-24">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
            <DoorIcon name="letter" />
          </span>
          <p className={`${eyebrow} mt-6`}>The weekly letter</p>
          <h2 className="mt-4 font-display text-3xl font-light leading-tight text-ivory sm:text-4xl">
            One story. One reflection. Every Sunday.
          </h2>
          <p className="mx-auto mt-4 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            A letter from the shelves, written for the evening it arrives in. Nothing
            else, and never more than once a week.
          </p>
          <Link
            href={'/letter' as Route}
            className="mt-8 inline-block rounded bg-gold px-8 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90"
          >
            Join the House
          </Link>
        </div>
      </section>
    </>
  );
}

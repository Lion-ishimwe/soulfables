import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getResidents, getShelves, getStories } from '@/lib/content';

export const metadata: Metadata = {
  title: 'About the House',
  description:
    'Soulfables is a library of feelings, organised by what they help you feel. Why the House exists, what it believes, and how it came to be.',
};

export const revalidate = 300;

/*
 * About the House.
 *
 * Carried over from the first Soulfables, where this page was the one
 * people sent to each other — the words, the reading room with its one
 * lamp, and the arrangement: the room on the left with the founding
 * sentence resting on its corner; on the right what the House is for
 * and the four things it holds to. Below that, one belief, how it came
 * to be, and a door out.
 *
 * The one addition is the row of numbers, which is the House's habit:
 * every number on a page is real, so a visitor can see the shelves are
 * not a metaphor.
 */

const VALUES = [
  {
    title: 'Emotional Truth',
    body: 'Every story is honest before it is beautiful. We write what is true, even when truth is uncomfortable.',
  },
  {
    title: 'Slowness',
    body: 'We resist the rush. Our stories are meant to be read slowly, reflected on, and returned to.',
  },
  {
    title: 'Inclusivity',
    body: 'Every soul has a story. We publish voices from every background, culture, and experience.',
  },
  {
    title: 'Healing',
    body: 'We believe stories have the power to mend — not by giving answers, but by offering recognition.',
  },
] as const;

const MOMENTS = [
  {
    title: 'The First Story',
    body: 'A single folktale, written at midnight, shared with three friends — and one wrote back at 3am.',
  },
  {
    title: 'The First Reader',
    body: 'A stranger said, “I thought I was the only one who felt this way.” The library had its first door.',
  },
  {
    title: 'The First Letter',
    body: 'Readers began writing back with their own stories. A conversation, written down, became a house.',
  },
  {
    title: 'The First Shelf',
    body: 'Stories were gathered by what they help you feel. The shelves appeared, one by one, in the dark.',
  },
  {
    title: 'The House Opens',
    body: 'Today the doors are left unlocked, and the lamp stays lit. Every soul has a story, and the House keeps them.',
  },
] as const;

function Glow({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute left-1/2 h-[24rem] w-[48rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl ${className}`}
      style={{
        background:
          'radial-gradient(ellipse at center, rgb(var(--c-gold) / 0.14) 0%, rgb(var(--c-gold) / 0) 70%)',
      }}
    />
  );
}

export default async function AboutPage() {
  const [stories, shelves, residents] = await Promise.all([getStories(), getShelves(), getResidents()]);
  const counts = [
    { n: stories.length, label: stories.length === 1 ? 'story' : 'stories' },
    { n: shelves.length, label: shelves.length === 1 ? 'shelf' : 'shelves' },
    { n: residents.length, label: residents.length === 1 ? 'resident' : 'residents' },
  ].filter((c) => c.n > 0);

  return (
    <div className="relative overflow-hidden">
      {/* ---- The reading room, and what the House is for ----------------- */}
      <section className="mx-auto grid max-w-page gap-14 px-5 pt-5 sm:grid-cols-[minmax(0,11fr)_minmax(0,13fr)] sm:gap-16 sm:px-8 sm:pt-6 lg:gap-20">
        {/*
          The room. A tall crop of the wide original, so the lamp sits
          low and the vaults rise above it. The founding sentence rests on
          the room's bottom corner and reaches past its edge, as it did
          in the first House; below the fold on a phone it simply sits
          beneath the picture.
        */}
        <div className="relative self-start pb-24 sm:pb-14">
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            <Image
              src="/house/reading-room.jpg"
              alt="A vast dark library with a single warm lamp glowing on a reading desk"
              fill
              priority
              sizes="(min-width: 640px) 45vw, 100vw"
              className="object-cover object-center"
            />
          </div>
          <blockquote className="absolute bottom-0 right-0 max-w-[17rem] border border-rule bg-ink-raised px-7 py-6 font-display text-[0.95rem] italic leading-relaxed text-gold sm:-right-8 lg:-right-10">
            “When someone opens Soulfables, they should feel like they have entered a peaceful library.”
          </blockquote>
        </div>

        <div className="sm:pt-4">
          <p className="sf-eyebrow">The House</p>
          <h1 className="mt-6 font-display text-4xl font-light leading-[1.12] text-ivory sm:text-5xl lg:text-[3.4rem]">
            The House was built for people carrying stories too heavy to carry alone.
          </h1>
          <p className="mt-7 font-display text-lg italic leading-snug text-ivory">
            We are a library of feelings, organised by what they help you feel.
          </p>
          <p className="mt-6 font-ui text-base leading-relaxed text-ivory">
            Soulfables tells modern folktales that help people feel seen, reflect deeply, and heal.
          </p>
          <p className="mt-5 font-ui text-[0.95rem] leading-relaxed text-grey-muted">
            Soulfables began because the world is loud, and people are lonely, and the stories we tell each
            other are the quietest, oldest cure for both. We are not a publisher. We are a library of feelings,
            organised by what they help you feel.
          </p>

          {/* The four things it holds to. */}
          <ul className="mt-9 grid gap-x-8 sm:grid-cols-2">
            {VALUES.map((v) => (
              <li key={v.title} className="border-t border-rule pb-6 pt-5">
                <h2 className="font-display text-lg text-ivory">{v.title}</h2>
                <p className="mt-2.5 font-ui text-[0.85rem] leading-relaxed text-grey-muted">{v.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- One belief ------------------------------------------------- */}
      <section className="relative mt-16 py-20 text-center sm:mt-24 sm:py-28">
        <Glow className="top-1/2 -translate-y-1/2" />
        <div className="relative mx-auto max-w-content px-5 sm:px-8">
          <p className="sf-eyebrow">What we believe</p>
          <p className="mx-auto mt-7 max-w-[30ch] font-display text-2xl font-light italic leading-snug text-ivory sm:text-4xl">
            We believe every person deserves to find one story that makes them feel less alone. If enough people
            find that story, the world becomes a gentler place.
          </p>
        </div>
      </section>

      {/* ---- How it came to be ------------------------------------------ */}
      <section className="mx-auto max-w-content px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="text-center">
          <p className="sf-eyebrow">The story of the House</p>
          <h2 className="mt-4 font-display text-3xl font-light leading-tight text-ivory sm:text-4xl">
            How Soulfables came to be
          </h2>
        </div>
        <ol className="mx-auto mt-14 max-w-[36rem] text-center">
          {MOMENTS.map((m, i) => (
            <li key={m.title} className={i === 0 ? '' : 'mt-10'}>
              <p aria-hidden="true" className="font-ui text-sm text-gold">
                ✦
              </p>
              <h3 className="mt-4 font-display text-2xl font-light text-ivory">{m.title}</h3>
              <p className="mx-auto mt-3 max-w-measure font-ui text-[0.95rem] leading-relaxed text-grey-muted">
                {m.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- The House today, in real numbers --------------------------- */}
      {counts.length > 0 && (
        <section className="mx-auto max-w-content px-5 pt-24 sm:px-8 sm:pt-28">
          <div className="border-y border-rule py-8">
            <p className="sf-eyebrow text-center">The House today</p>
            <dl className="mt-6 flex flex-wrap justify-center gap-x-14 gap-y-6">
              {counts.map((c) => (
                <div key={c.label} className="text-center">
                  <dd className="font-display text-4xl font-light tabular-nums text-ivory">{c.n}</dd>
                  <dt className="mt-1 font-ui text-xs uppercase tracking-[0.16em] text-grey-muted">{c.label}</dt>
                </div>
              ))}
            </dl>
            {shelves.length > 0 && (
              <p className="mx-auto mt-6 max-w-measure text-center font-display text-base italic text-grey-muted">
                {shelves.map((s) => s.label).join(' · ')}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---- The door out ------------------------------------------------ */}
      <section className="relative mx-auto max-w-content px-5 pb-8 pt-24 text-center sm:px-8 sm:pt-28">
        <p className="mt-5 font-display text-2xl font-light italic text-ivory sm:text-3xl">
          The lamp will be here when you return.
        </p>
        <p className="mt-6 text-gold" aria-hidden="true">
          ✦
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <Link
            href="/library"
            className="inline-block border border-gold/50 px-7 py-3 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
          >
            Enter the Library
          </Link>
          <Link
            href="/letter"
            className="border-b border-gold/40 pb-1 font-ui text-sm text-gold transition-colors duration-base ease-house hover:border-gold hover:text-gold-soft"
          >
            Write to the House →
          </Link>
        </div>
      </section>
    </div>
  );
}

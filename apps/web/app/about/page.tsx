import type { Metadata } from 'next';
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
 * people sent to each other. The words are kept; the room is rebuilt in
 * the House's own materials — the lamp, the rules, the display face —
 * rather than around a generated picture that belonged to a different
 * building.
 *
 * Arranged as the reference was: the lamp and a line about what
 * entering should feel like; what the House is for; the four things it
 * holds to; one belief; how it came to be; and a door out. The only
 * thing added is the row of numbers, which is the House's habit: every
 * number on a page is real, so a visitor can see the shelves are not a
 * metaphor.
 */

const VALUES = [
  {
    title: 'Emotional truth',
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
    title: 'The first story',
    body: 'A single folktale, written at midnight, shared with three friends — and one wrote back at 3am.',
  },
  {
    title: 'The first reader',
    body: 'A stranger said, “I thought I was the only one who felt this way.” The library had its first door.',
  },
  {
    title: 'The first letter',
    body: 'Readers began writing back with their own stories. A conversation, written down, became a house.',
  },
  {
    title: 'The first shelf',
    body: 'Stories were gathered by what they help you feel. The shelves appeared, one by one, in the dark.',
  },
  {
    title: 'The House opens',
    body: 'Today the doors are left unlocked, and the lamp stays lit. Every soul has a story, and the House keeps them.',
  },
] as const;

/** A dark reading room with one lamp lit at the far end. Drawn, not photographed. */
function LampWindow() {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-rule bg-ink-raised"
    >
      {/* The shelves: rows of them, and two uprights, fading into the dark. */}
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, rgb(var(--c-ivory) / 0.5) 0 1px, transparent 1px 12.5%), linear-gradient(90deg, transparent 0 18%, rgb(var(--c-ivory) / 0.45) 18% calc(18% + 1px), transparent calc(18% + 1px) 82%, rgb(var(--c-ivory) / 0.45) 82% calc(82% + 1px), transparent calc(82% + 1px))',
        }}
      />
      {/* The floor, catching a little of the light. */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            'linear-gradient(180deg, rgb(var(--c-ink) / 0) 0%, rgb(var(--c-ink) / 0.9) 100%)',
        }}
      />
      {/* The lamp. */}
      <div
        className="absolute left-1/2 top-[58%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle at center, rgb(var(--c-gold) / 0.55) 0%, rgb(var(--c-gold) / 0.18) 30%, rgb(var(--c-gold) / 0) 65%)',
        }}
      />
      <div className="absolute left-1/2 top-[58%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-soft shadow-[0_0_24px_8px_rgb(var(--c-gold)/0.7)]" />
      {/* The vignette that makes it a room rather than a pattern. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, rgb(var(--c-ink) / 0) 20%, rgb(var(--c-ink) / 0.85) 75%, rgb(var(--c-ink)) 100%)',
        }}
      />
    </div>
  );
}

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
      <Glow className="-top-32" />

      {/* ---- The lamp, and what entering should feel like ---------------- */}
      <section className="relative mx-auto grid max-w-content items-center gap-10 px-5 pt-16 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-14 sm:px-8 sm:pt-24">
        <LampWindow />
        <div>
          <p className="sf-eyebrow">About the House</p>
          <blockquote className="mt-5 font-display text-3xl font-light italic leading-snug text-ivory sm:text-4xl">
            “When someone opens Soulfables, they should feel like they have entered a peaceful library.”
          </blockquote>
          <p className="mt-6 max-w-measure font-reading text-base leading-relaxed text-grey-muted">
            That sentence was written before the first story was, and every room since has been built to keep it.
          </p>
        </div>
      </section>

      {/* ---- What the House is for -------------------------------------- */}
      <section className="mx-auto max-w-content px-5 pt-24 sm:px-8 sm:pt-32">
        <p className="sf-eyebrow">The House</p>
        <h1 className="mt-5 max-w-[22ch] font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          The House was built for people carrying stories too heavy to carry alone.
        </h1>
        <p className="mt-6 max-w-measure font-display text-xl italic leading-snug text-gold-soft sm:text-2xl">
          We are a library of feelings, organised by what they help you feel.
        </p>
        <div className="mt-8 max-w-measure space-y-5 font-reading text-lg leading-relaxed text-grey">
          <p>Soulfables tells modern folktales that help people feel seen, reflect deeply, and heal.</p>
          <p className="text-grey-muted">
            Soulfables began because the world is loud, and people are lonely, and the stories we tell each
            other are the quietest, oldest cure for both. We are not a publisher. We are a library of feelings,
            organised by what they help you feel.
          </p>
        </div>
      </section>

      {/* ---- What it holds to ------------------------------------------- */}
      <section className="mx-auto max-w-content px-5 pt-24 sm:px-8 sm:pt-28">
        <p className="sf-eyebrow">What the House holds to</p>
        <ul className="mt-8 grid gap-x-12 sm:grid-cols-2">
          {VALUES.map((v) => (
            <li key={v.title} className="border-t border-rule py-7">
              <h2 className="font-display text-2xl font-light text-ivory">{v.title}</h2>
              <p className="mt-3 max-w-measure font-reading text-base leading-relaxed text-grey-muted">{v.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- One belief ------------------------------------------------- */}
      <section className="relative mt-28 py-20 text-center sm:py-28">
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
        <ol className="relative mx-auto mt-14 max-w-[40rem] border-l border-rule pl-8 sm:pl-12">
          {MOMENTS.map((m, i) => (
            <li key={m.title} className={i === 0 ? '' : 'mt-12'}>
              <span
                aria-hidden="true"
                className="absolute -left-[0.55rem] mt-1.5 font-ui text-sm leading-none text-gold"
              >
                ✦
              </span>
              <h3 className="font-display text-2xl font-light text-ivory">{m.title}</h3>
              <p className="mt-2 max-w-measure font-reading text-base leading-relaxed text-grey-muted">{m.body}</p>
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
        <p className="text-gold" aria-hidden="true">
          ✦
        </p>
        <p className="mt-5 font-display text-2xl font-light italic text-ivory sm:text-3xl">
          The lamp will be here when you return.
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

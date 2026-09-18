import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { getCards } from '@/lib/questions';
import { QuestionDrawer } from '@/components/question-drawer';

export const metadata: Metadata = {
  title: 'Quiet Questions',
  description:
    'A drawer of quiet questions. Draw one, write what comes, and keep it in your journal.',
};

/*
 * The drawer of quiet questions.
 *
 * Carried over from the first House: one card face down, a tap to turn
 * it, a question signed by the Librarian, a place to write, and two
 * ways on — keep it, or pull another. Beneath the drawer, three doors
 * to the rest of the reading room.
 *
 * The page knows whether somebody is signed in only so the drawer can
 * say, before they write, that keeping needs a name.
 */

const DOORS = [
  {
    href: '/journal',
    title: 'Your Journal',
    body: 'Read past reflections',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5Z" />
        <path d="M11.5 5.5l3 3" />
      </svg>
    ),
  },
  {
    href: '/library',
    title: 'Listen',
    body: 'Stories read aloud',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
        <path d="M3 8v4M6.5 5v10M10 7v6M13.5 3v14M17 8v4" />
      </svg>
    ),
  },
  {
    href: '/letter',
    title: 'Weekly Letter',
    body: 'A letter each week',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
        <rect x="2.5" y="4.5" width="15" height="11" rx="1" />
        <path d="M2.5 6l7.5 5.5L17.5 6" />
      </svg>
    ),
  },
] as const;

export default async function QuestionsPage() {
  const [cards, viewer] = await Promise.all([getCards(), getViewer()]);

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-[26rem] w-[50rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgb(var(--c-gold) / 0.12) 0%, rgb(var(--c-gold) / 0) 70%)',
        }}
      />

      <section className="relative mx-auto max-w-content px-5 pt-20 text-center sm:px-8 sm:pt-24">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true" className="mx-auto text-gold">
          <path d="M13 3l10 5-10 5L3 8l10-5Z" />
          <path d="M3 13l10 5 10-5" />
          <path d="M3 18l10 5 10-5" />
        </svg>
        <p className="sf-eyebrow mt-5">The drawer of quiet questions</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          Quiet Questions
        </h1>
        <p className="mx-auto mt-6 max-w-measure font-display text-lg italic leading-relaxed text-grey">
          {cards.length} {cards.length === 1 ? 'question' : 'questions'} waiting quietly on the shelves. Each one
          carries a whisper and opens a door you didn’t know was there.
        </p>
      </section>

      <section className="relative mx-auto max-w-content px-5 pt-14 sm:px-8 sm:pt-16">
        <QuestionDrawer cards={cards} signedIn={Boolean(viewer)} />
      </section>

      {/* ---- The rest of the reading room ------------------------------ */}
      <section className="mx-auto max-w-content px-5 pt-24 sm:px-8 sm:pt-28">
        <p className="sf-eyebrow text-center">The universe</p>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
          {DOORS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href as Route}
                className="group flex h-full flex-col items-center border border-rule bg-ink-raised/40 px-5 py-7 text-center transition-colors duration-base ease-house hover:border-gold/50 hover:bg-ink-raised"
              >
                <span className="text-gold">{d.icon}</span>
                <span className="mt-4 font-display text-lg text-ivory">{d.title}</span>
                <span className="mt-1 font-ui text-xs text-grey-muted">{d.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-content px-5 pb-8 pt-24 text-center sm:px-8 sm:pt-28">
        <p className="font-display text-2xl font-light italic text-ivory sm:text-3xl">
          The lamp will be here when you return.
        </p>
        <p className="mt-6 text-gold" aria-hidden="true">
          ✦
        </p>
      </section>
    </div>
  );
}

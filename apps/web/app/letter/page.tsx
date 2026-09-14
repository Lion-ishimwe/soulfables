import type { Metadata } from 'next';
import { getViewer } from '@/lib/auth';
import { getPublishedLetters } from '@/lib/letters';
import { LetterForm } from '@/components/letter-form';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'The Weekly Letter',
  description: 'One story, one reflection, every Sunday. A letter from the shelves, written slowly.',
  alternates: { canonical: '/letter' },
};

export const dynamic = 'force-dynamic';

/**
 * The letter's front door.
 *
 * What it is, the one field to join it, and the letters already sent
 * for anyone who wants to read before they decide. There is no
 * newsletter machinery on show because there is none to show: a letter
 * is written, then sent, then kept here.
 */
export default async function LetterPage() {
  const [viewer, letters] = await Promise.all([getViewer(), getPublishedLetters()]);

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The Weekly Letter</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          One story. One reflection. Every Sunday.
        </h1>
        <p className="mx-auto mt-6 max-w-measure font-reading text-lg leading-relaxed text-grey">
          Not a newsletter — a letter, written slowly, from whichever shelf the week has been
          about. A story worth your evening, a question worth your journal, and nothing to buy.
        </p>
      </header>

      <section className="mt-12 text-center">
        <LetterForm defaultEmail={viewer?.email ?? ''} />
      </section>

      <section className="mt-20 border-t border-rule pt-10">
        <p className="sf-eyebrow mb-6 text-center">Letters so far</p>
        {letters.length === 0 ? (
          <p className="mx-auto max-w-measure text-center font-ui text-sm leading-relaxed text-grey-muted">
            The first letter has not gone out yet. When it does, it will be kept here for anyone
            who joins later.
          </p>
        ) : (
          <ul className="divide-y divide-rule border border-rule">
            {letters.map((l) => (
              <li key={l.slug} className="px-6 py-5">
                <p className="font-ui text-micro uppercase tracking-[0.18em] text-grey-muted">
                  Vol. {l.volume} · No. {l.number} · {formatDate(l.publishedAt)}
                </p>
                <p className="mt-1.5 font-display text-2xl text-ivory">{l.title}</p>
                {l.dek && <p className="mt-1 font-display text-base italic text-grey-muted">{l.dek}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPlan } from '@/lib/membership';
import { getViewer } from '@/lib/auth';
import { getReaderVoices } from '@/lib/community';

export const metadata: Metadata = {
  title: 'Residents',
  description:
    'Those who live in the House rather than visit — and the lines readers leave without signing their names.',
  alternates: { canonical: '/residents' },
};

export const dynamic = 'force-dynamic';

/*
 * Residents.
 *
 * Brief §5 asks for this to stay flexible, so it is built thin on
 * purpose: a room that exists, says honestly what it is for, and shows
 * the one community artefact the House already has — unsigned lines from
 * readers. No feeds, no profiles, no follower counts. Those are decisions
 * that have not been made yet, and building them now would make them by
 * accident.
 */
export default async function ResidentsPage() {
  const [viewer, plan, voices] = await Promise.all([
    getViewer(),
    getPlan(),
    getReaderVoices(),
  ]);

  const isResident = plan === 'resident';

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The House</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          Residents
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Those who live here rather than visit. What that comes to mean is
          still being decided, and it is being decided slowly — a community
          built in a hurry becomes somebody else&rsquo;s community.
        </p>
      </header>

      <section className="mt-14 border border-rule p-8 text-center sm:p-10">
        {isResident ? (
          <>
            <p className="sf-eyebrow text-gold">You live here</p>
            <p className="mt-4 font-display text-2xl text-ivory">
              The whole House is open to you.
            </p>
            <p className="mx-auto mt-3 max-w-measure text-sm leading-normal text-grey-muted">
              The premium shelves, the narrated editions, and the Librarian
              whenever you want them. When the Residents&rsquo; rooms open,
              you will already be inside.
            </p>
            <Link
              href="/companion"
              className="mt-7 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
            >
              Talk to the Librarian
            </Link>
          </>
        ) : (
          <>
            <p className="sf-eyebrow">Residency</p>
            <p className="mt-4 font-display text-2xl text-ivory">
              Most of the House is open to everyone.
            </p>
            <p className="mx-auto mt-3 max-w-measure text-sm leading-normal text-grey-muted">
              Residency is for people who keep coming back — the narrated
              editions, the premium shelves, and a standing invitation to
              whatever this room becomes.
            </p>
            <Link
              href="/membership"
              className="mt-7 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
            >
              {viewer ? 'See residency' : 'Sign in and see residency'}
            </Link>
          </>
        )}
      </section>

      <section className="mt-16">
        <p className="sf-eyebrow mb-2 text-center">Reader voices</p>
        <p className="mx-auto mb-8 max-w-measure text-center text-sm leading-normal text-grey-muted">
          Lines people leave without signing their names. Moderated before
          they appear, and never attributed.
        </p>

        <ul className="space-y-px bg-rule">
          {voices.map((v) => (
            <li key={v.id} className="bg-ink px-7 py-6">
              <p className="font-display text-xl font-light italic leading-snug text-grey">
                “{v.body}”
              </p>
              {v.storyTitle && (
                <p className="mt-3 font-ui text-xs text-grey-muted">
                  After reading{' '}
                  <Link
                    href={`/story/${v.storySlug}`}
                    className="text-gold transition-colors hover:text-gold-soft"
                  >
                    {v.storyTitle}
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-16 text-center font-display text-xl italic text-grey-muted">
        The lamp will be here when you return.
      </p>
    </div>
  );
}

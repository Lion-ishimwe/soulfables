import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { getMoods, getTodaysPrompt, getEntries } from '@/lib/journal';
import { getReading, getSavedStories } from '@/lib/library';
import { JournalComposer } from '@/components/journal-composer';
import { deleteEntry } from '@/app/actions/journal';

export const metadata: Metadata = {
  title: 'Your Reading Room',
  description:
    'Every story leaves an echo. This is where you keep them — a private journal, and the record of what you have read.',
  // Never indexed. The journal is private and the page is per-reader.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The Reading Room.
 *
 * Signed out, this still renders: the question of the day is shown, the
 * shape of the room is visible, and the invitation is to sign in. Showing
 * someone an empty locked door is worse than showing them the room.
 */
export default async function JournalPage() {
  const viewer = await getViewer();

  const [moods, prompt, entries, reading, saved] = await Promise.all([
    getMoods(),
    getTodaysPrompt(),
    viewer ? getEntries() : Promise.resolve([]),
    viewer ? getReading() : Promise.resolve({ inProgress: [], finished: [] }),
    viewer ? getSavedStories() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="mb-14 text-center">
        <p className="text-gold" aria-hidden="true">
          ✦
        </p>
        <h1 className="mt-5 font-display text-4xl font-light text-ivory sm:text-5xl">
          Your Reading Room
        </h1>
        <p className="mx-auto mt-4 max-w-measure font-display text-xl italic text-grey-muted">
          Every story leaves an echo. This is where you keep them.
        </p>
      </header>

      <JournalComposer
        moods={moods}
        prompt={prompt}
        signedIn={Boolean(viewer)}
      />

      {viewer && (
        <>
          {/* Recent reflections */}
          <section className="mt-16">
            <h2 className="sf-eyebrow mb-6">Recent reflections</h2>

            {entries.length === 0 ? (
              <div className="border border-rule px-8 py-12 text-center">
                <p className="font-display text-2xl text-ivory">
                  Your journal is waiting.
                </p>
                <p className="mt-3 text-sm text-grey-muted">
                  The first page is always the hardest to write.
                </p>
              </div>
            ) : (
              <ul className="space-y-px bg-rule">
                {entries.map((e) => (
                  <li key={e.id} className="bg-ink p-7">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="font-ui text-xs text-grey-muted">
                        {when(e.createdAt)}
                        {e.moodLabel && (
                          <span className="ml-3">
                            {e.moodEmoji} {e.moodLabel}
                          </span>
                        )}
                      </p>
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={e.id} />
                        <button
                          type="submit"
                          className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger"
                        >
                          Delete
                        </button>
                      </form>
                    </div>

                    {e.title && (
                      <h3 className="mt-3 font-display text-2xl text-ivory">
                        {e.title}
                      </h3>
                    )}

                    <p className="mt-3 whitespace-pre-wrap font-reading text-base leading-relaxed text-grey">
                      {e.body}
                    </p>

                    {e.storySlug && (
                      <p className="mt-4 text-xs text-grey-muted">
                        After reading{' '}
                        <Link
                          href={`/story/${e.storySlug}`}
                          className="text-gold transition-colors hover:text-gold-soft"
                        >
                          {e.storyTitle}
                        </Link>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Reading history */}
          <section className="mt-16">
            <h2 className="sf-eyebrow mb-6">Reading history</h2>
            {reading.inProgress.length === 0 && reading.finished.length === 0 ? (
              <div className="border border-rule px-8 py-12 text-center">
                <p className="font-display text-2xl text-ivory">
                  The House remembers.
                </p>
                <p className="mt-3 text-sm text-grey-muted">
                  You haven&rsquo;t wandered into a story yet. The shelves are
                  waiting.
                </p>
                <Link
                  href="/library"
                  className="mt-6 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
                >
                  Enter the library
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-rule border border-rule">
                {[...reading.inProgress, ...reading.finished].map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/story/${r.slug}`}
                      className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-ink-raised"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-display text-xl text-ivory">
                          {r.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-grey-muted">
                          {r.completedAt
                            ? 'Finished'
                            : `${Math.round(r.percent * 100)}% through`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Favourites */}
          <section className="mt-16">
            <h2 className="sf-eyebrow mb-6">Favourite stories</h2>
            {saved.length === 0 ? (
              <div className="border border-rule px-8 py-12 text-center">
                <p className="font-display text-2xl text-ivory">
                  A shelf of the ones that stayed.
                </p>
                <p className="mt-3 text-sm text-grey-muted">
                  When one stays with you, it will rest here.
                </p>
              </div>
            ) : (
              <ul className="flex flex-wrap gap-2.5">
                {saved.map((s) => (
                  <li key={s!.slug}>
                    <Link
                      href={`/story/${s!.slug}`}
                      className="inline-block border border-rule px-4 py-2 font-ui text-sm text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
                    >
                      {s!.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="mt-20 text-center font-display text-xl italic text-grey-muted">
        The House remembers.
      </p>
    </div>
  );
}

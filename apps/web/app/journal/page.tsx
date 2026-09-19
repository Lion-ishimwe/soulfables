import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import {
  getMoods,
  getTodaysPrompt,
  getEntries,
  countEntries,
  getSectionsFor,
  type Entry,
} from '@/lib/journal';
import { getReading, getSavedStories } from '@/lib/library';
import { getStories, getShelves } from '@/lib/content';
import { JournalComposer, type StoryOption } from '@/components/journal-composer';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { JournalEntryBody } from '@/components/journal-entry-body';
import { deleteEntry } from '@/app/actions/journal';
import { getAffirmationOfTheDay } from '@/lib/affirmations';
import { canUseSoulAI } from '@/lib/ai/access';
import { JournalInsights } from '@/components/journal-insights';
import { MoodStrip } from '@/components/mood-strip';
import { getGuidedJournal } from '@/lib/guided';

export const metadata: Metadata = {
  title: 'Your Reading Room',
  description:
    'Every story leaves an echo. This is where you keep them — a private journal, and the record of what you have read.',
  // Never indexed. The journal is private and the page is per-reader.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const RECENT = 12;

const longDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
const monthOf = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const monthShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
const dayOf = (iso: string) => String(new Date(iso).getDate()).padStart(2, '0');

/** The first breath of an entry, cut at a word, for the list. */
function excerpt(body: string, max = 180) {
  const flat = body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

const CalendarMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const BookMark = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5ZM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5Z" />
  </svg>
);

/*
 * The Reading Room.
 *
 * Signed out, this still renders: the question of the day is shown, the
 * shape of the room is visible, and the invitation is to sign in. Showing
 * someone an empty locked door is worse than showing them the room.
 *
 * Signed in, everything on the page is the reader's own — RLS scopes
 * every read to them, and no policy lets staff in. The header counts
 * their reflections, the composer offers their shelf, and the journal
 * below is theirs alone.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; all?: string; story?: string; guided?: string; day?: string }>;
}) {
  const { q, all, story: fromStory, guided, day } = await searchParams;
  const offset = Math.max(0, Math.min(99, Number(q) || 0));
  const showAll = all === '1';

  const viewer = await getViewer();

  const [moods, prompt, entries, total, reading, saved, catalogue, shelves, affirmation, soul] = await Promise.all([
    getMoods(),
    getTodaysPrompt(offset),
    viewer ? getEntries(showAll ? 500 : RECENT) : Promise.resolve([] as Entry[]),
    viewer ? countEntries() : Promise.resolve(null),
    viewer ? getReading() : Promise.resolve({ inProgress: [], finished: [] }),
    viewer ? getSavedStories() : Promise.resolve([]),
    getStories(),
    getShelves(),
    getAffirmationOfTheDay(),
    viewer ? canUseSoulAI() : Promise.resolve(false),
  ]);

  /*
   * The reader's shelf, as things a reflection can be pinned to: what
   * they are reading, have finished, or have saved — never the whole
   * library. Ids come from the catalogue, because the shelf rows carry
   * slugs and the journal stores ids.
   */
  /*
   * A guided journal's day, when the reader arrived from one. The
   * prompt's id names the journey and the day, so saving the page moves
   * them on. Premium only; anyone else sees the ordinary question.
   */
  let guidedPrompt: { id: string; body: string } | null = null;
  let guidedEyebrow: string | undefined;
  if (guided && soul) {
    const journey = await getGuidedJournal(guided);
    const n = Math.max(1, Math.min(journey?.days ?? 1, Number(day) || 1));
    const step = journey?.steps.find((st) => st.day === n);
    if (journey && step) {
      guidedPrompt = { id: `guided:${journey.slug}:${n}`, body: step.prompt };
      guidedEyebrow = `${journey.title} · day ${n} of ${journey.days}`;
    }
  }
  const idOf = new Map(catalogue.filter((s) => s.id).map((s) => [s.slug, s.id as string]));
  const seen = new Set<string>();
  const shelf: StoryOption[] = [];
  for (const row of [...reading.inProgress, ...reading.finished, ...saved]) {
    if (!row || seen.has(row.slug)) continue;
    const id = idOf.get(row.slug);
    if (!id) continue;
    seen.add(row.slug);
    shelf.push({ id, slug: row.slug, title: row.title });
  }

  /*
   * The whole library, with each story's shelf, so the composer can add
   * a shelf's stories when a feeling is chosen — Healing brings the
   * Healing shelf. Sections are fetched for all of it rather than just
   * the reader's shelf: a few stories, a handful of sections each, and
   * it means switching stories never waits on a round trip.
   */
  const library: StoryOption[] = catalogue
    .filter((s) => s.id)
    .map((s) => ({ id: s.id as string, slug: s.slug, title: s.title, shelf: s.shelf }));

  /*
   * Arrived from a story's page ("Write about this"): that story is
   * already chosen, and if it is not on the reader's shelf yet it is
   * put there for the composer's list — they were just reading it,
   * which is more than a bookmark says.
   */
  const arrived = fromStory ? library.find((s) => s.slug === fromStory) ?? null : null;
  if (arrived && !shelf.some((s) => s.id === arrived.id)) shelf.unshift(arrived);

  const sections = viewer ? await getSectionsFor(library.map((s) => s.id)) : [];

  // Entries by month, newest first, for the eyebrow between groups.
  const byMonth: { month: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const m = monthOf(e.createdAt);
    const last = byMonth[byMonth.length - 1];
    if (last && last.month === m) last.items.push(e);
    else byMonth.push({ month: m, items: [e] });
  }

  const today = new Date();

  return (
    <div className="mx-auto max-w-content px-5 py-16 sm:px-8 sm:py-20">
      {/* ---- The door ------------------------------------------------ */}
      <header className="mb-10 text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <h1 className="mt-5 font-display text-4xl font-light text-ivory sm:text-5xl">
          Your Reading Room
        </h1>
        <p className="mx-auto mt-4 max-w-measure font-display text-xl italic text-grey-muted">
          Every story leaves an echo. This is where you keep them.
        </p>

        {affirmation && (
          <p className="mx-auto mt-6 max-w-measure border-y border-gold/25 py-4 font-display text-lg italic leading-snug text-ivory">
            {affirmation.body}
          </p>
        )}
        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-ui text-sm text-grey-muted">
          <span className="flex items-center gap-2">
            <CalendarMark />
            {longDate(today)}
          </span>
          {viewer && total !== null && (
            <>
              <span aria-hidden="true" className="hidden h-4 w-px bg-rule sm:block" />
              <span className="flex items-center gap-2">
                <BookMark />
                {total.toLocaleString()} {total === 1 ? 'reflection' : 'reflections'}
              </span>
            </>
          )}
        </p>
      </header>

      <JournalComposer
        moods={moods}
        prompt={guidedPrompt ?? prompt}
        promptEyebrow={guidedEyebrow}
        anotherHref={`/journal?q=${offset + 1}`}
        stories={shelf}
        library={library}
        shelves={shelves.map((s) => ({ slug: s.slug, label: s.label }))}
        sections={sections}
        signedIn={Boolean(viewer)}
        initialStoryId={arrived?.id ?? ''}
      />

      {viewer && <MoodStrip entries={entries} />}
      {viewer && <JournalInsights allowed={soul} entries={total ?? entries.length} />}

      {viewer && (
        <>
          {/* ---- The journal ------------------------------------------ */}
          <section className="mt-16 border-t border-gold/25 pt-10">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-light text-ivory">From Your Journal</h2>
                <p className="mt-1 font-display text-base italic text-grey-muted">
                  Stories of your journey.
                </p>
              </div>
              {total !== null && total > entries.length && (
                <Link
                  href={'/journal?all=1' as Route}
                  className="font-ui text-sm text-gold transition-colors hover:text-gold-soft"
                >
                  View all {total.toLocaleString()} entries →
                </Link>
              )}
              {showAll && total !== null && total > RECENT && (
                <Link
                  href={'/journal' as Route}
                  className="font-ui text-sm text-gold transition-colors hover:text-gold-soft"
                >
                  Show recent only
                </Link>
              )}
            </div>

            {entries.length === 0 ? (
              <div className="rounded-xl border border-rule px-8 py-14 text-center">
                <p className="font-display text-2xl text-ivory">Your journal is waiting.</p>
                <p className="mt-3 text-sm text-grey-muted">
                  The first page is always the hardest to write.
                </p>
              </div>
            ) : (
              byMonth.map((group) => (
                <div key={group.month} className="mb-8">
                  <p className="mb-4 font-ui text-micro uppercase tracking-[0.18em] text-grey-muted">
                    {group.month}
                  </p>
                  <ul className="space-y-3">
                    {group.items.map((e) => (
                      <li
                        key={e.id}
                        className="relative rounded-lg border border-rule bg-ink-raised/50 transition-colors hover:border-rule-strong"
                      >
                        {/*
                          The row opens in place. There is no entry page —
                          a reflection is read where it was written — so
                          the chevron expands rather than navigates.
                        */}
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-stretch gap-0 pr-24 [&::-webkit-details-marker]:hidden">
                            <span className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-rule py-5 text-center">
                              <span className="font-ui text-micro uppercase tracking-[0.18em] text-grey-muted">
                                {monthShort(e.createdAt)}
                              </span>
                              <span className="mt-0.5 font-display text-3xl font-light leading-none text-ivory">
                                {dayOf(e.createdAt)}
                              </span>
                            </span>

                            <span className="min-w-0 flex-1 px-5 py-4">
                              {e.moodLabel && (
                                <span className="flex items-center gap-2 font-ui text-sm text-ivory">
                                  <span aria-hidden="true">{e.moodEmoji}</span>
                                  {e.moodLabel}
                                </span>
                              )}
                              <span className="mt-1.5 block font-display text-lg italic leading-snug text-grey group-open:hidden">
                                &ldquo;{excerpt(e.body)}&rdquo;
                              </span>
                              {(e.storyTitle || e.title) && (
                                <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-ui text-xs text-grey-muted group-open:hidden">
                                  {e.title && <span className="text-ivory">{e.title}</span>}
                                  {e.storyTitle && <span>{e.storyTitle}</span>}
                                  {e.sectionTitle && (
                                    <>
                                      <span aria-hidden="true">•</span>
                                      <span>{e.sectionTitle}</span>
                                    </>
                                  )}
                                </span>
                              )}
                            </span>

                            <span
                              aria-hidden="true"
                              className="absolute right-5 top-1/2 -translate-y-1/2 text-grey-faint transition-transform group-open:rotate-90"
                            >
                              ›
                            </span>
                          </summary>

                          <div className="border-t border-rule px-5 py-5 sm:pl-[6.25rem]">
                            <JournalEntryBody id={e.id} title={e.title} body={e.body} />
                            {e.storySlug && (
                              <p className="mt-4 font-ui text-xs text-grey-muted">
                                After reading{' '}
                                <Link
                                  href={`/story/${e.storySlug}` as Route}
                                  className="text-gold transition-colors hover:text-gold-soft"
                                >
                                  {e.storyTitle}
                                </Link>
                                {e.sectionTitle && <> — {e.sectionTitle}</>}
                              </p>
                            )}
                          </div>
                        </details>

                        {/* Outside the summary, so opening the menu does
                            not also open the entry. */}
                        <span className="absolute right-11 top-1/2 -translate-y-1/2">
                          <KebabMenu
                            label={`Reflection from ${longDate(new Date(e.createdAt))}`}
                            items={[
                              {
                                kind: 'action',
                                label: 'Delete reflection',
                                action: deleteEntry,
                                fields: { id: e.id },
                                danger: true,
                                confirm: 'Delete this reflection?',
                                confirmBody: 'It is yours alone, and it cannot be recovered.',
                                confirmLabel: 'Delete',
                              },
                            ]}
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {/*
            The shelf used to be repeated here. It lives in My Library,
            and a journal is for the words a story left, not the list of
            stories — so this points there instead of copying it.
          */}
          <p className="mt-12 text-center font-ui text-sm text-grey-muted">
            What you are reading, and what stayed, is in{' '}
            <Link href={'/account/library' as Route} className="text-gold transition-colors hover:text-gold-soft">
              your library
            </Link>
            .
          </p>
        </>
      )}

      <p className="mt-20 text-center font-display text-xl italic text-grey-muted">
        The House remembers.
      </p>
    </div>
  );
}

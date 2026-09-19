import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getGuidedJournal, getGuidedProgress } from '@/lib/guided';
import { getViewer, isStaff } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/membership';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const j = await getGuidedJournal(slug);
  return j ? { title: j.title, description: j.description ?? undefined } : { title: 'Guided journal' };
}

/**
 * One journey: the days, which are done, and the one to write today.
 *
 * Progress moves when a reflection is saved to a day's prompt, so the
 * only button here is "write it", which opens the journal with that
 * prompt in place.
 */
export default async function GuidedJournalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [journal, progress, viewer] = await Promise.all([getGuidedJournal(slug), getGuidedProgress(), getViewer()]);
  if (!journal) notFound();
  const premium = viewer ? isStaff(viewer.role) || (await hasPremiumAccess()) : false;
  const p = progress[slug];
  const done = p ? Math.min(p.lastDay, journal.days) : 0;
  const today = Math.min(done + 1, journal.days);
  const finished = done >= journal.days;

  return (
    <div className="mx-auto max-w-content px-5 py-16 sm:px-8 sm:py-20">
      <Link href={'/journal/guided' as Route} className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory">
        ← All guided journals
      </Link>
      <header className="mt-8">
        <p className="sf-eyebrow">{journal.days} days</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">{journal.title}</h1>
        {journal.description && <p className="mt-4 max-w-measure text-base leading-normal text-grey-muted">{journal.description}</p>}
      </header>

      {!premium ? (
        <div className="mt-10 border border-gold/25 bg-gold-dim px-6 py-6">
          <p className="font-display text-xl text-ivory">This journey is for Premium.</p>
          <p className="mt-2 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
            You can read what it asks below. Writing to it, and keeping your place, is part of Premium.
          </p>
          <Link href={'/membership' as Route} className="mt-5 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink">
            See Premium
          </Link>
        </div>
      ) : finished ? (
        <div className="mt-10 border border-gold/25 bg-gold-dim px-6 py-6">
          <p className="font-display text-xl text-ivory">You have written every day of this journey.</p>
          <p className="mt-2 font-ui text-sm text-grey-muted">The pages are in your journal. Come back to any day below whenever you like.</p>
        </div>
      ) : (
        <div className="mt-10 border border-rule bg-ink-raised/40 px-6 py-6">
          <p className="sf-eyebrow">{p ? `Day ${today} of ${journal.days}` : 'Begin'}</p>
          <p className="mt-3 font-display text-2xl font-light italic leading-snug text-ivory">
            {journal.steps.find((s) => s.day === today)?.prompt}
          </p>
          <Link
            href={`/journal?guided=${journal.slug}&day=${today}` as Route}
            className="mt-6 inline-block bg-gold px-6 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-soft"
          >
            {p ? `Write day ${today}` : 'Begin day one'}
          </Link>
        </div>
      )}

      <ol className="mt-12 divide-y divide-rule border-y border-rule">
        {journal.steps.map((s) => {
          const isDone = s.day <= done;
          const isToday = premium && !finished && s.day === today;
          return (
            <li key={s.day} className="flex gap-5 py-5">
              <span className={`w-16 shrink-0 font-ui text-micro uppercase tracking-[0.16em] ${isDone ? 'text-gold' : isToday ? 'text-ivory' : 'text-grey-faint'}`}>
                Day {s.day}
                {isDone && <span className="ml-1" aria-label="written">✦</span>}
              </span>
              <p className={`font-display text-lg italic leading-snug ${isDone || isToday ? 'text-ivory' : 'text-grey-muted'}`}>{s.prompt}</p>
              {premium && (isDone || isToday) && (
                <Link href={`/journal?guided=${journal.slug}&day=${s.day}` as Route} className="ml-auto shrink-0 self-center font-ui text-xs text-gold transition-colors hover:text-gold-soft">
                  {isDone ? 'Write again' : 'Write'}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

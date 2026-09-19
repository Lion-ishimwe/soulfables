import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getGuidedJournals, getGuidedProgress } from '@/lib/guided';
import { getViewer, isStaff } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/membership';

export const metadata: Metadata = {
  title: 'Guided Journals',
  description: 'A journey of prompts, one a day, for the weeks that need a shape.',
};

export const dynamic = 'force-dynamic';

/** The journeys on offer, and how far along each one this reader is. */
export default async function GuidedJournalsPage() {
  const [journals, progress, viewer] = await Promise.all([getGuidedJournals(), getGuidedProgress(), getViewer()]);
  const premium = viewer ? isStaff(viewer.role) || (await hasPremiumAccess()) : false;

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The Reading Room</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">Guided Journals</h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          A journey of prompts, one a day, for the weeks that need a shape. Each page you write is
          kept in your journal like any other; the journey only remembers where you got to.
        </p>
        {!premium && (
          <p className="mx-auto mt-5 max-w-measure font-ui text-sm text-grey-muted">
            Guided journals are part of{' '}
            <Link href={'/membership' as Route} className="text-gold hover:text-gold-soft">Premium</Link>.
            Anyone may read what each one asks.
          </p>
        )}
      </header>

      <ul className="mt-14 grid gap-px bg-rule sm:grid-cols-2">
        {journals.map((j) => {
          const p = progress[j.slug];
          const done = p ? Math.min(p.lastDay, j.days) : 0;
          return (
            <li key={j.slug} className="bg-ink">
              <Link href={`/journal/guided/${j.slug}` as Route} className="block h-full p-8 transition-colors hover:bg-ink-raised">
                <p className="font-ui text-xs text-grey-muted">
                  {j.days} days{p ? ` · day ${Math.min(done + 1, j.days)} of ${j.days}` : ''}
                </p>
                <h2 className="mt-3 font-display text-2xl font-light text-ivory">{j.title}</h2>
                {j.description && <p className="mt-2 text-sm leading-normal text-grey-muted">{j.description}</p>}
                {p && (
                  <div className="mt-5 h-px w-full bg-rule" aria-hidden="true">
                    <div className="h-px bg-gold" style={{ width: `${Math.round((done / j.days) * 100)}%` }} />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

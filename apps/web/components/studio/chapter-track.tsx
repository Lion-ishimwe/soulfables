import type { EditorialChapter } from '@/lib/demo/editorial';

/**
 * Where a serial has got to.
 *
 * A list of chapters answers "what exists". It does not answer the two
 * questions somebody actually opens a serial with after a fortnight away:
 * what have readers already had, and what am I supposed to write next.
 *
 * So this states both in words before the list repeats them in rows —
 * released up to N, drafted as far as M, next one is M+1. A writer
 * returning to a half-finished serial should not have to reconstruct
 * that by reading a table.
 *
 * It also names gaps. Chapters are numbered by hand, so 1, 2, 4 is
 * possible and is nearly always a mistake — a reader would hit a wall
 * between two released episodes.
 */
export function ChapterTrack({ chapters }: { chapters: EditorialChapter[] }) {
  const ordered = [...chapters].sort((a, b) => a.number - b.number);
  const released = ordered.filter((c) => c.status === 'published');
  const drafts = ordered.filter((c) => c.status !== 'published');

  const highest = ordered.reduce((n, c) => Math.max(n, c.number), 0);
  const lastReleased = released.reduce((n, c) => Math.max(n, c.number), 0);
  const next = highest + 1;

  /*
   * A missing number between the first and the highest. Only reported
   * where it falls inside what has been released, because a gap ahead of
   * the release front is just work not started yet.
   */
  const gaps: number[] = [];
  for (let n = 1; n < highest; n++) {
    if (!ordered.some((c) => c.number === n)) gaps.push(n);
  }

  const words = ordered.reduce((sum, c) => sum + (c.bodyMdx?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0);

  if (ordered.length === 0) {
    return (
      <p className="border border-rule px-5 py-6 font-ui text-sm leading-relaxed text-grey-muted">
        Nothing written yet. Chapter&nbsp;1 is the next one — the form below starts
        there, and readers see nothing until a chapter is released.
      </p>
    );
  }

  return (
    <div className="border border-rule">
      {/* ---- Where you are ---------------------------------------- */}
      <div className="grid gap-px bg-rule sm:grid-cols-3">
        <div className="bg-ink px-5 py-4">
          <p className="sf-eyebrow mb-1.5">Readers have</p>
          <p className="font-display text-2xl text-ivory">
            {released.length === 0 ? 'Nothing yet' : `Up to ${lastReleased}`}
          </p>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            {released.length} of {ordered.length} released
          </p>
        </div>

        <div className="bg-ink px-5 py-4">
          <p className="sf-eyebrow mb-1.5">Written, not out</p>
          <p className="font-display text-2xl text-ivory">
            {drafts.length === 0 ? 'None waiting' : `${drafts.length} waiting`}
          </p>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            {drafts.length === 0
              ? 'Everything written has been released'
              : `Chapter ${drafts.map((d) => d.number).join(', ')}`}
          </p>
        </div>

        <div className="bg-ink px-5 py-4">
          <p className="sf-eyebrow mb-1.5">Start next</p>
          <p className="font-display text-2xl text-gold">Chapter {next}</p>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            {words.toLocaleString()} words so far
          </p>
        </div>
      </div>

      {gaps.length > 0 && (
        <p className="border-t border-rule bg-state-danger/10 px-5 py-3 font-ui text-xs text-ivory">
          {gaps.length === 1 ? 'Chapter' : 'Chapters'} {gaps.join(', ')}{' '}
          {gaps.length === 1 ? 'is' : 'are'} missing. A reader who reaches{' '}
          {gaps[0] - 1} finds nothing after it.
        </p>
      )}

      {/* ---- The run ------------------------------------------------ */}
      <ol className="divide-y divide-rule border-t border-rule">
        {ordered.map((c) => {
          const count = c.bodyMdx?.trim().split(/\s+/).filter(Boolean).length ?? 0;
          const out = c.status === 'published';
          return (
            <li key={c.id} className="flex items-baseline gap-4 px-5 py-3">
              <span
                className={`w-8 shrink-0 font-mono text-sm ${out ? 'text-gold' : 'text-grey-faint'}`}
              >
                {c.number}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-ui text-sm text-ivory">{c.title}</span>
                <span className="mt-0.5 block font-ui text-xs text-grey-muted">
                  {count === 0
                    ? 'Empty — a title with nothing under it'
                    : `${count.toLocaleString()} words · about ${Math.max(1, Math.ceil(count / 220))} min`}
                </span>
              </span>

              <span
                className={`shrink-0 font-ui text-micro uppercase tracking-[0.12em] ${
                  out ? 'text-state-success' : 'text-grey-muted'
                }`}
              >
                {out ? 'Released' : 'Draft'}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

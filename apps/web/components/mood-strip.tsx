import type { Entry } from '@/lib/journal';

/**
 * The mood tracker: thirty days, one cell each.
 *
 * Drawn from the reader's own entries — the feeling they attached to
 * each reflection — so it costs nothing to keep and asks nothing new.
 * A day with several entries shows the last one written. Nothing here
 * is a chart of wellbeing; it is a calendar of what they named.
 */

const DAYS = 30;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function MoodStrip({ entries }: { entries: Entry[] }) {
  const today = new Date();
  const byDay = new Map<string, { label: string; emoji: string | null }>();
  for (const e of entries) {
    if (!e.moodLabel) continue;
    const key = e.createdAt.slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, { label: e.moodLabel, emoji: e.moodEmoji });
  }

  const cells: { key: string; day: number; mood: { label: string; emoji: string | null } | null }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    cells.push({ key, day: d.getDate(), mood: byDay.get(key) ?? null });
  }

  const counts = new Map<string, { emoji: string | null; n: number }>();
  for (const c of cells) {
    if (!c.mood) continue;
    const cur = counts.get(c.mood.label) ?? { emoji: c.mood.emoji, n: 0 };
    cur.n += 1;
    counts.set(c.mood.label, cur);
  }
  const named = cells.filter((c) => c.mood).length;

  return (
    <section className="mt-12 border border-rule bg-ink-raised/40 px-6 py-7 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sf-eyebrow">Mood tracker</p>
          <h2 className="mt-2 font-display text-2xl font-light text-ivory">The last thirty days</h2>
        </div>
        <p className="font-ui text-xs text-grey-muted">
          {named === 0 ? 'No feelings named yet.' : `${named} ${named === 1 ? 'day' : 'days'} with a feeling named.`}
        </p>
      </div>

      <ol className="mt-5 grid grid-cols-10 gap-1.5 sm:grid-cols-15" aria-label="One cell per day, most recent last">
        {cells.map((c) => (
          <li
            key={c.key}
            title={c.mood ? `${c.key}: ${c.mood.label}` : `${c.key}: nothing named`}
            className={`flex aspect-square items-center justify-center border text-sm ${
              c.mood ? 'border-gold/40 bg-gold-dim' : 'border-rule bg-ink'
            }`}
          >
            {c.mood ? (
              <span aria-hidden="true">{c.mood.emoji ?? '✦'}</span>
            ) : (
              <span className="font-ui text-[0.6rem] text-grey-faint">{c.day}</span>
            )}
            <span className="sr-only">{c.mood ? c.mood.label : 'nothing named'}</span>
          </li>
        ))}
      </ol>

      {counts.size > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-ui text-xs text-grey-muted">
          {[...counts.entries()]
            .sort((a, b) => b[1].n - a[1].n)
            .map(([label, v]) => (
              <li key={label} className="flex items-center gap-1.5">
                <span aria-hidden="true">{v.emoji ?? '✦'}</span>
                <span className="text-ivory">{label}</span>
                <span>× {v.n}</span>
              </li>
            ))}
        </ul>
      )}
      <p className="mt-4 font-ui text-xs leading-relaxed text-grey-faint">
        A calendar of what you named when you wrote, not a measure of anything. Days you did not write
        stay blank.
      </p>
    </section>
  );
}

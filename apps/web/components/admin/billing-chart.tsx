import { Icon } from './dashboard';

/**
 * Spend over time, in money.
 *
 * Not the dashboard's AreaChart, for two reasons that turn out to be the
 * same reason. That chart draws whatever days it is given; this one draws
 * the whole window, zero-filled, so the axis is the calendar rather than
 * the handful of days something happened — a month with two spikes reads
 * as a month, not as two adjacent bars. And when nothing has been spent
 * at all, the axis is still there with an explanation sitting inside it:
 * an empty chart frame says the feature is broken, an empty chart frame
 * with the reason written on it says it is waiting.
 *
 * Values are in USD millionths and formatted as dollars on the axis. When
 * the whole window is zero the axis shows $0.00 to $0.10 anyway, so the
 * scale the reader will see later is the scale they see now.
 */
export function SpendChart({
  days,
  byDay,
  id,
}: {
  days: number;
  byDay: { day: string; costMicros: number }[];
  id: string;
}) {
  // Fill the window: one point per calendar day, most recent last.
  const lookup = new Map(byDay.map((d) => [d.day, d.costMicros]));
  const points: { day: string; micros: number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({ day: key, micros: lookup.get(key) ?? 0 });
  }

  const total = points.reduce((n, p) => n + p.micros, 0);
  const maxMicros = Math.max(...points.map((p) => p.micros));

  // Axis in dollars. A quiet window still gets a believable scale.
  const ticksDollars = maxMicros === 0 ? [0, 0.05, 0.1] : niceDollarTicks(maxMicros / 1_000_000);
  const top = ticksDollars[ticksDollars.length - 1];

  const w = 1000;
  const h = 260;
  const padL = 0;
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const y = (micros: number) => h - (micros / 1_000_000 / top) * h;
  const coords = points.map((p, i) => ({ x: padL + i * step, y: y(p.micros) }));
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z`;

  // Five date labels across the bottom, first and last always included.
  const labelCount = Math.min(5, points.length);
  const labelIdx = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i * (points.length - 1)) / (labelCount - 1)),
  );
  const shortDate = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div className="relative">
      <div className="flex gap-3">
        {/* Y axis, in dollars. */}
        <div className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right font-ui text-micro tabular-nums text-grey-faint" style={{ height: 200 }}>
          {[...ticksDollars].reverse().map((t) => (
            <span key={t}>${t.toFixed(2)}</span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="block h-[200px] w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C89528" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#C89528" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Gridlines, one per tick. */}
            {ticksDollars.map((t) => (
              <line
                key={t}
                x1="0"
                x2={w}
                y1={h - (t / top) * h}
                y2={h - (t / top) * h}
                style={{ stroke: 'rgb(var(--c-ivory))' }}
                strokeOpacity="0.07"
                strokeDasharray="4 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {total > 0 && <path d={area} fill={`url(#${id}-fill)`} />}
            <path d={line} fill="none" stroke="#C89528" strokeWidth="2" vectorEffect="non-scaling-stroke" />

            {/* One marker per day. */}
            {coords.map((c, i) => (
              <circle
                key={points[i].day}
                cx={c.x}
                cy={c.y}
                r="3"
                style={{ fill: 'rgb(var(--c-ink))' }}
                stroke="#C89528"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="mt-2 flex justify-between font-ui text-micro text-grey-faint">
            {labelIdx.map((i) => (
              <span key={points[i].day}>{shortDate(points[i].day)}</span>
            ))}
          </div>
        </div>
      </div>

      {total === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8 pl-12">
          <div className="max-w-xs text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
              <Icon name="trend" className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-3 font-ui text-sm text-ivory">No usage yet</p>
            <p className="mt-1 font-ui text-xs leading-relaxed text-grey-muted">
              Your spending will appear here once the assistant starts writing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function niceDollarTicks(max: number, count = 4): number[] {
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const stepSize = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const top = Math.ceil(max / stepSize) * stepSize;
  return Array.from({ length: Math.round(top / stepSize) + 1 }, (_, i) => Number((i * stepSize).toFixed(4)));
}

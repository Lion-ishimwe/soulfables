import type { SeriesPoint } from '@/lib/admin-dashboard';

/**
 * Charts, drawn by hand in SVG.
 *
 * No charting library. Three reasons, in order of weight: these render on
 * the server, so the dashboard costs no client JavaScript at all; the
 * whole visual language here is a few strokes and one gradient, which is
 * less code than configuring a library to stop doing things; and the same
 * approach already draws the cover art, so the house style is consistent.
 *
 * Every one of these renders nothing rather than something when it has no
 * data. A chart with no data is not a flat line — a flat line is a
 * measurement, and "not measured yet" is a different claim.
 */

const GOLD = '#C89528';

/**
 * Axis labels are HTML, not SVG text.
 *
 * The plot is stretched to its container with preserveAspectRatio="none",
 * which is what keeps the curve smooth at any width — but it would
 * squash any text inside it too. Keeping the labels outside the SVG lets
 * them stay the right size and inherit the page's font.
 */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function curve(points: SeriesPoint[], w: number, h: number, top: number) {
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: i * step,
    y: h - (p.value / (top || 1)) * h,
  }));

  /*
   * A monotone cubic through the points. Straight segments make sparse
   * daily data look jagged; a smooth curve reads as a trend, which is
   * what this is for. Control points are horizontal only, so the curve
   * never overshoots a peak and invents a value nobody measured.
   */
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const mid = (a.x + b.x) / 2;
    d += ` C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  }
  return { d, coords };
}

function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function AreaChart({
  points,
  id,
  metricLabel,
}: {
  points: SeriesPoint[];
  id: string;
  metricLabel: string;
}) {
  if (points.length < 2) return null;

  const w = 1000;
  const h = 260;
  const max = Math.max(...points.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const { d, coords } = curve(points, w, h, top);

  const last = coords[coords.length - 1];
  const lastPoint = points[points.length - 1];
  const fill = `${d} L ${last.x} ${h} L 0 ${h} Z`;

  // Five evenly spaced dates along the bottom, first and last included.
  const labelCount = Math.min(6, points.length);
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round((i * (points.length - 1)) / (labelCount - 1)),
  );

  return (
    <div className="flex gap-3">
      {/* y axis */}
      <div
        className="flex flex-col-reverse justify-between py-0 font-ui text-micro text-grey-faint"
        style={{ height: h / 2 }}
      >
        {ticks.map((t) => (
          <span key={t} className="leading-none">
            {t >= 1000 ? `${t / 1000}k` : t}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: h / 2 }}>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            role="img"
            aria-label={`${metricLabel}: ${points.length} days, ending at ${lastPoint.value}`}
          >
            <defs>
              <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity="0.3" />
                <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => {
              const y = h - (t / (top || 1)) * h;
              return (
                <line
                  key={t}
                  x1="0"
                  x2={w}
                  y1={y}
                  y2={y}
                  style={{ stroke: 'var(--c-rule-strong)' }}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <path d={fill} fill={`url(#area-${id})`} />
            <path
              d={d}
              fill="none"
              stroke={GOLD}
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/*
            The marker and its callout are positioned in percentages over
            the plot rather than drawn inside it, so neither is stretched
            by the SVG's non-uniform scaling.
          */}
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-gold"
            style={{ left: '100%', top: `${(last.y / h) * 100}%` }}
          />
          <span
            className="pointer-events-none absolute -translate-x-full -translate-y-1/2 whitespace-nowrap border border-rule bg-ink px-3 py-2 text-left"
            style={{ left: 'calc(100% - 14px)', top: `${(last.y / h) * 100}%` }}
          >
            <span className="block font-ui text-micro text-grey-muted">
              {shortDate(lastPoint.date)}
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              <span className="font-ui text-micro text-grey">{metricLabel}</span>
              <span className="font-ui text-xs text-ivory">{lastPoint.value}</span>
            </span>
          </span>
        </div>

        {/* x axis */}
        <div className="mt-3 flex justify-between font-ui text-micro text-grey-faint">
          {labelIndices.map((i) => (
            <span key={i}>{shortDate(points[i].date)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A line small enough to sit in a table cell. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;

  const w = 80;
  const h = 24;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const d = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (v / max) * h}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-6 w-20" aria-hidden="true">
      <path d={d} fill="none" stroke={GOLD} strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

/** Colours for the revenue split, all inside the House palette. */
export const SLICE_COLOURS = ['#C89528', '#E0B45A', '#8A6A1E', '#5C4614', '#3A2C0D'];

/**
 * A donut. Renders as an empty ring when everything is zero, which is the
 * honest picture of a shop that has not sold anything yet.
 */
export function Donut({
  slices,
  size = 190,
}: {
  slices: { label: string; amount: number }[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  const r = size / 2 - 14;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={total > 0 ? 'Revenue by product kind' : 'No revenue yet'}
    >
      <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: 'var(--c-rule-strong)' }} strokeWidth="16" />

      {total > 0 &&
        slices.map((s, i) => {
          const dash = (s.amount / total) * circumference;
          const el = (
            <circle
              key={s.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={SLICE_COLOURS[i % SLICE_COLOURS.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
          offset += dash;
          return el;
        })}
    </svg>
  );
}

import Link from 'next/link';
import type { Route } from 'next';
import type { StatCardData, Trend } from '@/lib/admin-dashboard';

/**
 * The dashboard's furniture: a card, a panel, a trend arrow, and the
 * small icons that sit beside them.
 *
 * Icons are inline SVG rather than a font or a package. There are nine of
 * them, they never change, and a dependency for nine paths is a
 * dependency to update forever.
 */

const ICONS: Record<string, string> = {
  book: 'M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Zm3 3v10h7V7H7Z',
  draft: 'M6 3h8l4 4v14H6V3Zm7 1.5V8h3.5L13 4.5ZM8 12h8v1.5H8V12Zm0 3.5h8V17H8v-1.5Z',
  box: 'M12 2 3 6.5v11L12 22l9-4.5v-11L12 2Zm0 2.2 6.4 3.2L12 10.6 5.6 7.4 12 4.2ZM5 9.2l6 3v7.1l-6-3V9.2Zm8 10.1v-7.1l6-3v7.1l-6 3Z',
  cart: 'M3 4h2.2l2.6 11h9.4l2.2-8H7M9 20a1.4 1.4 0 1 0 0-2.8A1.4 1.4 0 0 0 9 20Zm8 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5H2Zm15.6 0c-.3-2-1.4-3.6-3-4.6 3.2.2 5.4 2.2 5.4 4.6h-2.4Z',
  layers: 'M12 3 2 8l10 5 10-5-10-5Zm0 2.2L17.8 8 12 10.8 6.2 8 12 5.2ZM2 12.5l10 5 10-5-1.8-.9L12 15.6 3.8 11.6 2 12.5Z',
  bell: 'M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-5v-5a7 7 0 0 0-5.5-6.8V4a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 12v5l-2 2v1h18v-1l-2-2Z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm1 3h-2v6l5 3 1-1.7-4-2.3V7Z',
  spark: 'M12 2 9.6 9.6 2 12l7.6 2.4L12 22l2.4-7.6L22 12l-7.6-2.4L12 2Z',
};

export function Icon({ name, className = 'h-4 w-4' }: { name: keyof typeof ICONS | string; className?: string }) {
  const d = ICONS[name] ?? ICONS.spark;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * A trend, or nothing.
 *
 * Nothing is shown when the preceding window was empty. Going from zero
 * orders to three is not "up 300%" — it is not a percentage at all, and
 * printing one would be the dashboard's first lie.
 */
function TrendBadge({ trend }: { trend: Trend | null }) {
  if (!trend || trend.percent === null) return null;

  const up = trend.direction === 'up';
  const flat = trend.direction === 'flat';

  return (
    <span className="flex items-center gap-1.5 font-ui text-micro">
      <span
        className={
          flat ? 'text-grey-muted' : up ? 'text-state-success' : 'text-state-danger'
        }
      >
        {flat ? '—' : up ? '↑' : '↓'} {Math.abs(trend.percent)}%
      </span>
      <span className="text-grey-faint">vs previous period</span>
    </span>
  );
}

const STAT_ICONS: Record<string, string> = {
  published: 'book',
  drafts: 'draft',
  products: 'box',
  orders: 'cart',
  readers: 'people',
  stories: 'layers',
};

export function StatCard({ stat }: { stat: StatCardData }) {
  const body = (
    <>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Icon name={STAT_ICONS[stat.key] ?? 'spark'} className="h-[18px] w-[18px]" />
        </span>
        <span className="font-ui text-xs text-grey-muted">{stat.label}</span>
      </div>

      <p className="font-display text-[2.5rem] leading-none text-ivory">
        {/* An em dash, not a zero. The number is unknown, not none. */}
        {stat.value === null ? (
          <span className="text-grey-faint">&mdash;</span>
        ) : (
          stat.value.toLocaleString()
        )}
      </p>

      <p className="mt-3 font-ui text-xs text-grey-muted">{stat.hint}</p>

      <div className="mt-2 min-h-[1.1rem]">
        <TrendBadge trend={stat.trend} />
      </div>
    </>
  );

  const className =
    'block rounded-lg border border-rule bg-ink-raised p-5 transition-colors hover:border-rule-strong';

  return stat.href ? (
    <Link href={stat.href as Route} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Panel({
  title,
  hint,
  action,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  action?: { href: string; label: string };
  /** A control that belongs to this panel rather than to the page. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-rule bg-ink-raised">
      <header className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-ui text-sm text-ivory">{title}</h2>
          {hint && <p className="mt-0.5 font-ui text-micro text-grey-faint">{hint}</p>}
        </div>
        {aside}
        {action && (
          <Link
            href={action.href as Route}
            className="shrink-0 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * What a panel shows when there is nothing to show.
 *
 * Deliberately plain, and deliberately says why rather than only that.
 * "No data" invites a bug report; "events begin the first time somebody
 * opens a story" does not.
 */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-12 text-center font-ui text-xs leading-relaxed text-grey-muted">
      {children}
    </p>
  );
}

export function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Activity chips, coloured by what happened.
 *
 * Colour is the second signal here, never the only one — the action is
 * always spelled out beside it. Someone who cannot tell the green from
 * the amber loses nothing but a shortcut.
 */
const ACTIVITY_STYLES: { match: RegExp; icon: string; className: string }[] = [
  { match: /publish/i, icon: 'book', className: 'bg-state-success/15 text-state-success' },
  { match: /order|refund|payment/i, icon: 'cart', className: 'bg-state-success/15 text-state-success' },
  { match: /product/i, icon: 'box', className: 'bg-gold/15 text-gold' },
  { match: /user|reader|author|role/i, icon: 'people', className: 'bg-[#5B7FA6]/20 text-[#8FB4DA]' },
  { match: /delete|remove|revoke/i, icon: 'clock', className: 'bg-state-danger/15 text-state-danger' },
  { match: /story|draft|submission/i, icon: 'draft', className: 'bg-[#7A5EA8]/20 text-[#B49BE0]' },
];

export function activityStyle(action: string) {
  return (
    ACTIVITY_STYLES.find((s) => s.match.test(action)) ?? {
      icon: 'spark',
      className: 'bg-gold/10 text-gold',
    }
  );
}

/** Seconds → "6m 12s", the way the panel shows read times. */
export function duration(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/**
 * The page title used across the admin.
 *
 * Matches the dashboard's greeting rather than sitting a size smaller,
 * so moving between sections does not feel like moving between two
 * products.
 */
export function AdminPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  /** A link, or any control — some pages open a dialog rather than navigate. */
  action?: { href: string; label: string } | React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[2.6rem] leading-tight text-ivory">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-prose font-ui text-sm text-grey-muted">{subtitle}</p>
        )}
      </div>

      {action &&
        (typeof action === 'object' && action !== null && 'href' in action ? (
          <Link
            href={(action as { href: string }).href as Route}
            className="flex shrink-0 items-center gap-2 rounded border border-gold/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            {(action as { label: string }).label}
          </Link>
        ) : (
          (action as React.ReactNode)
        ))}
    </div>
  );
}

/** A dot and a word: account state, readable without relying on colour. */
export function StatusDot({
  tone,
  label,
}: {
  tone: 'active' | 'idle' | 'none';
  label: string;
}) {
  const colour =
    tone === 'active'
      ? 'bg-state-success'
      : tone === 'idle'
        ? 'bg-gold'
        : 'bg-grey-faint';

  return (
    <span className="flex items-center gap-2 font-ui text-xs text-ivory">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colour}`} />
      {label}
    </span>
  );
}

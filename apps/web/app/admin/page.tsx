import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import {
  dashboardStats,
  dashboardSeries,
  recentActivity,
  topStories,
  revenueByKind,
  RANGES,
  rangeFor,
} from '@/lib/admin-dashboard';
import { requireStaff } from '@/lib/auth';
import { isReadOnly } from '@/lib/admin-data';
import { ReadOnlyNotice } from '@/components/admin/ui';
import {
  StatCard,
  Panel,
  PanelEmpty,
  Icon,
  relativeTime,
  activityStyle,
  duration,
} from '@/components/admin/dashboard';
import { RangeSelect } from '@/components/admin/range-select';
import { AreaChart, Donut, Sparkline, SLICE_COLOURS } from '@/components/admin/charts';
import { Thumb } from '@/components/admin/thumb';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

/**
 * The dashboard.
 *
 * Every number here is queried. Where a number does not exist yet the
 * panel says so, and says why — there are no placeholder charts, no
 * sample stories, no invented revenue. A new House therefore opens on a
 * page of mostly zeros, which is the accurate picture of a new House and
 * the reason the empty states are written as sentences rather than as
 * "No data".
 */
export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; range?: string }>;
}) {
  const params = await searchParams;
  const range = rangeFor(params.range);
  const viewer = await requireStaff();

  const [stats, series, activity, top, revenue] = await Promise.all([
    dashboardStats(range.days),
    dashboardSeries(range.days),
    recentActivity(4),
    topStories(5),
    revenueByKind(),
  ]);

  const active = series.find((s) => s.key === params.metric) ?? series[0];

  const money = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: revenue.currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);

  const firstName = (viewer.displayName ?? viewer.email ?? 'there').split(' ')[0];

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const rangeLabel = `${fmt(new Date(Date.now() - range.days * 86_400_000))} – ${fmt(new Date())}, ${new Date().getFullYear()}`;
  const keep = (extra: Record<string, string>) =>
    new URLSearchParams({ range: range.key, ...extra }).toString();

  return (
    <>
      {/* ---- Greeting ------------------------------------------------ */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl leading-tight text-ivory sm:text-[2.6rem]">
            Welcome back, {firstName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 font-ui text-sm text-grey-muted">
            Here is what is happening on Soulfables.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/*
            A label, not a second control. The reference design shows a
            date range here and a range dropdown inside the analytics
            panel; wiring both to the same value would give two widgets
            that silently change each other. This states the window, and
            the panel changes it.
          */}
          <span className="flex items-center gap-2.5 rounded border border-rule px-4 py-2.5 font-ui text-xs text-grey">
            <Icon name="clock" className="h-3.5 w-3.5 text-grey-muted" />
            {rangeLabel}
          </span>
          <span className="hidden h-8 w-px bg-rule sm:block" />
          <Link
            href={'/admin/stories/new' as Route}
            className="flex items-center gap-2 rounded border border-gold/60 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink"
          >
            <Icon name="draft" className="h-3.5 w-3.5" />
            New story
          </Link>
        </div>
      </div>

      {isReadOnly() && (
        <div className="mb-7">
          <ReadOnlyNotice />
        </div>
      )}

      {/* ---- Stat row ------------------------------------------------ */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </div>

      {/* ---- Chart + activity ---------------------------------------- */}
      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Analytics Overview"
            aside={<RangeSelect param="range" value={range.key} options={RANGES} />}
          >
            {/*
              Tabs are links, not buttons. The page renders on the server,
              so changing metric is a navigation — which also means the
              view survives a refresh and can be sent to somebody.
            */}
            <nav className="flex gap-1 border-b border-rule px-5">
              {series.map((s) => {
                const on = s.key === active.key;
                return (
                  <Link
                    key={s.key}
                    href={`/admin?${keep({ metric: s.key })}` as Route}
                    aria-current={on ? 'page' : undefined}
                    className={`-mb-px border-b-2 px-3 py-3 font-ui text-xs transition-colors ${
                      on
                        ? 'border-gold text-gold'
                        : 'border-transparent text-grey-muted hover:text-ivory'
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
            </nav>

            {active.empty ? (
              <PanelEmpty>{active.note ?? 'Nothing recorded in this window.'}</PanelEmpty>
            ) : (
              <div className="px-5 pb-5 pt-6">
                <AreaChart id={active.key} points={active.points} metricLabel={active.label} />
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Recent Activity" action={{ href: '/admin/settings/audit', label: 'View all' }}>
          {activity.length === 0 ? (
            <PanelEmpty>
              The audit log is empty. Every staff action that changes something is
              written here as it happens.
            </PanelEmpty>
          ) : (
            <ul className="px-2 py-1.5">
              {activity.map((a) => {
                const style = activityStyle(a.action);
                return (
                  <li key={a.id} className="flex items-start gap-3 rounded px-3 py-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.className}`}
                    >
                      <Icon name={style.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-ui text-sm text-ivory">
                        {a.action.replace(/[._]/g, ' ')}
                      </span>
                      <span className="mt-0.5 block truncate font-ui text-xs text-grey-muted">
                        {a.actor ?? 'system'}
                        {a.entityType ? ` · ${a.entityType}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-ui text-xs text-grey-faint">
                      {relativeTime(a.at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ---- Stories + revenue --------------------------------------- */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel
            title="Top Performing Stories"
            hint="Lifetime views, not this period"
            action={{ href: '/admin/stories', label: 'View all' }}
          >
            {top.length === 0 ? (
              <PanelEmpty>
                Nothing published yet. The first page is always the hardest.
              </PanelEmpty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[38rem]">
                  <thead>
                    <tr className="border-b border-rule text-left font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                      <th className="px-5 py-3 font-normal">Story</th>
                      <th className="w-24 px-3 py-3 font-normal">Views</th>
                      <th className="w-24 px-3 py-3 font-normal">Reads</th>
                      <th className="w-32 px-3 py-3 font-normal">Avg. read time</th>
                      <th className="w-28 px-5 py-3 font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-rule/60 transition-colors last:border-0 hover:bg-ink-hover"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/stories/${s.id}` as Route}
                            className="flex items-center gap-3"
                          >
                            <Thumb src={s.coverImage} title={s.title} />
                            <span className="min-w-0">
                              <span className="block truncate font-ui text-sm text-ivory">
                                {s.title}
                              </span>

                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 font-ui text-sm text-ivory">
                          {s.views.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 font-ui text-sm text-grey">
                          {s.reads.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 font-ui text-sm text-grey-muted">
                          {duration(s.avgSeconds)}
                        </td>
                        <td className="px-5 py-3">
                          <Sparkline values={s.spark} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Sales Overview" hint="All paid orders">
          <div className="px-5 py-6">
            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="relative shrink-0">
                <Donut slices={revenue.slices} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-ui text-micro text-grey-muted">Total revenue</span>
                  <span className="mt-1 font-display text-2xl text-ivory">
                    {money(revenue.total)}
                  </span>
                </div>
              </div>

              {revenue.slices.length > 0 && (
                <ul className="min-w-[10rem] flex-1 space-y-3">
                  {revenue.slices.map((s, i) => (
                    <li key={s.label} className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: SLICE_COLOURS[i % SLICE_COLOURS.length] }}
                      />
                      <span className="flex-1 font-ui text-xs text-grey">{s.label}</span>
                      <span className="font-ui text-xs text-grey-muted">
                        {money(s.amount)} ({s.percent}%)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {revenue.total === 0 && (
              <p className="mt-6 text-center font-ui text-micro leading-relaxed text-grey-muted">
                No paid orders yet. The shop is built; the payment provider is the
                last milestone and is not connected.
              </p>
            )}

            <div className="mt-6 border-t border-rule pt-4">
              <Link
                href={'/admin/orders' as Route}
                className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
              >
                View full sales report →
              </Link>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

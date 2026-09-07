import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getSpendReport, getKeyHealth } from '@/lib/billing';
import { formatMicros } from '@/lib/ai/pricing';
import { AdminPageHeader, Panel, PanelEmpty, StatusDot } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { AreaChart } from '@/components/admin/charts';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

const CONSOLE = 'https://console.anthropic.com/settings/billing';

/** What each job is, said once, in the House's words rather than the code's. */
const JOB_LABEL: Record<string, string> = {
  draft: 'Starting a draft',
  continue: 'Carrying on',
  titles: 'Naming it',
  companion: 'The Librarian',
  unknown: 'Unattributed',
};

/*
 * What the writing assistant costs.
 *
 * The provider's console holds the authoritative total and the card
 * details, and nothing here tries to replace either — there is no API to
 * buy credit with, so topping up will always be a trip to Anthropic. What
 * this page does is answer the questions that make somebody take that
 * trip, and the ones the console cannot answer at all: which feature the
 * money went on, which story ran away with it, and whether the key is
 * working right now.
 *
 * The last of those used to be discoverable only by trying to write
 * something and reading a red sentence in a form.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStaff();

  const { days: rawDays } = await searchParams;
  const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;

  const report = await getSpendReport(days);
  const health = await getKeyHealth(report);

  const tone =
    health.state === 'working'
      ? 'active'
      : health.state === 'missing'
        ? 'none'
        : 'danger';

  const stats = [
    { label: `Spent, last ${days} days`, value: formatMicros(report.totals.costMicros), hint: 'Estimated from published rates' },
    { label: 'Since the first call', value: formatMicros(report.lifetime.costMicros), hint: report.lifetime.firstCall ? `From ${formatDate(report.lifetime.firstCall)}` : 'Nothing yet' },
    { label: 'Calls', value: report.totals.calls.toLocaleString(), hint: `${report.totals.failed} failed` },
    { label: 'Words written', value: Math.round(report.totals.outputTokens * 0.75).toLocaleString(), hint: `${report.totals.outputTokens.toLocaleString()} output tokens` },
  ];

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      {/* ---- Is it working? ------------------------------------------ */}
      <div
        className={`mb-6 rounded-lg border px-5 py-5 ${
          health.state === 'working'
            ? 'border-rule bg-ink-raised'
            : 'border-state-danger/40 bg-state-danger/5'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <StatusDot tone={tone} label={health.headline} />
              {health.keyTail && (
                <span className="font-mono text-xs text-grey-faint">
                  key {health.keyTail}
                </span>
              )}
            </div>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-grey-muted">
              {health.detail}
            </p>
          </div>

          <a
            href={CONSOLE}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-lg border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            {health.state === 'no_credit' ? 'Top up credit ↗' : 'Anthropic billing ↗'}
          </a>
        </div>

        <p className="mt-4 border-t border-rule pt-3.5 font-ui text-micro leading-relaxed text-grey-faint">
          Writing with <span className="text-grey-muted">{health.model}</span> at
          ${health.rate.input}/M in, ${health.rate.output}/M out
          {!health.rate.known && ' — rates unknown for this model, estimated at Opus prices'}.
          Anthropic has no API for buying credit, so topping up is always a trip
          to their console; everything else about the assistant lives here.
        </p>
      </div>

      {/* ---- The numbers --------------------------------------------- */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={(d === 30 ? '/admin/settings/billing' : `/admin/settings/billing?days=${d}`) as Route}
              aria-current={d === days ? 'page' : undefined}
              className={`rounded-lg border px-3.5 py-2 font-ui text-xs transition-colors ${
                d === days
                  ? 'border-gold/50 bg-gold-dim text-gold'
                  : 'border-rule text-grey-muted hover:border-gold/40 hover:text-ivory'
              }`}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-rule bg-ink-raised p-4 sm:p-5">
            <p className="font-ui text-xs text-grey-muted">{s.label}</p>
            <p className="mt-2 font-display text-3xl leading-none text-ivory">{s.value}</p>
            <p className="mt-2 font-ui text-xs text-grey-faint">{s.hint}</p>
          </div>
        ))}
      </div>

      {report.byDay.length > 1 && (
        <div className="mb-6">
          <Panel title="Spend by day" hint={`Last ${days} days`}>
            <div className="px-5 pb-5 pt-6">
              <AreaChart
                id="billing-daily"
                points={report.byDay.map((d) => ({
                  date: d.day,
                  value: Math.round(d.costMicros / 1000),
                }))}
                metricLabel="Thousandths of a cent"
              />
            </div>
          </Panel>
        </div>
      )}

      {/* ---- Where it went ------------------------------------------- */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="By feature" hint="What the money was spent doing">
          {report.byJob.length === 0 ? (
            <PanelEmpty>
              Nothing written with the assistant in this window.
            </PanelEmpty>
          ) : (
            <ul className="divide-y divide-rule">
              {report.byJob.map((j) => (
                <li key={j.job} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="min-w-0">
                    <span className="block text-sm text-ivory">
                      {JOB_LABEL[j.job] ?? j.job}
                    </span>
                    <span className="font-ui text-xs text-grey-faint">
                      {j.calls} {j.calls === 1 ? 'call' : 'calls'}
                    </span>
                  </span>
                  <span className="shrink-0 font-ui text-sm tabular-nums text-ivory">
                    {formatMicros(j.costMicros)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="By person" hint="Who asked for it">
          {report.byAuthor.length === 0 ? (
            <PanelEmpty>Nobody has used it in this window.</PanelEmpty>
          ) : (
            <ul className="divide-y divide-rule">
              {report.byAuthor.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="min-w-0 truncate text-sm text-ivory">{a.email}</span>
                  <span className="shrink-0 font-ui text-sm tabular-nums text-ivory">
                    {formatMicros(a.costMicros)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title="By story"
        hint="Which stories the assistant was used on"
      >
        {report.byStory.length === 0 ? (
          <PanelEmpty>
            No spend is attributed to a story yet. Anything written from the
            Writing Room with a story open is counted here.
          </PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem]">
              <thead>
                <tr className="border-b border-rule text-left font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                  <th className="px-5 py-3 font-normal">Story</th>
                  <th className="w-24 px-5 py-3 font-normal">Calls</th>
                  <th className="w-28 px-5 py-3 text-right font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.byStory.map((s) => (
                  <tr key={s.slug} className="border-b border-rule/60 last:border-0 hover:bg-ink-hover">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/stories/${s.slug}` as Route}
                        className="font-ui text-sm text-ivory transition-colors hover:text-gold"
                      >
                        {s.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-ui text-sm tabular-nums text-grey-muted">
                      {s.calls}
                    </td>
                    <td className="px-5 py-3 text-right font-ui text-sm tabular-nums text-ivory">
                      {formatMicros(s.costMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-rule px-5 py-4 font-ui text-micro leading-relaxed text-grey-faint">
          These figures are the House's own, counted from what the model
          reported on each call and priced from Anthropic's published rates.
          They are an estimate and will differ from the invoice — caching and
          rate changes both move it.{' '}
          <a href={CONSOLE} target="_blank" rel="noreferrer noopener" className="text-gold transition-colors hover:text-gold-soft">
            Anthropic's console
          </a>{' '}
          is what is actually owed. Reader payments are a different thing
          entirely and are not built yet.
        </p>
      </Panel>
    </>
  );
}

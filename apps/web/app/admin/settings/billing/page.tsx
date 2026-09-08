import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getSpendReport, getKeyHealth } from '@/lib/billing';
import { formatMicros } from '@/lib/ai/pricing';
import { AdminPageHeader, Panel, Icon } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { SpendChart } from '@/components/admin/billing-chart';
import { UsageBreakdown } from '@/components/admin/usage-breakdown';
import { Thumb } from '@/components/admin/thumb';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Billing' };
export const dynamic = 'force-dynamic';

const CONSOLE_BILLING = 'https://platform.claude.com/settings/billing';
const CONSOLE_COST = 'https://platform.claude.com/cost';

/*
 * The features that spend money, in the House's words, with the icon each
 * one wears. Only these five exist. The Librarian is rule-based and never
 * reaches the model, so it is not here — listing it at $0.00 would suggest
 * a cost that is waiting to happen, when there is no such cost.
 */
const JOBS: Record<string, { label: string; icon: string }> = {
  concepts: { label: 'Proposing concepts', icon: 'spark' },
  draft: { label: 'Starting a draft', icon: 'spark' },
  continue: { label: 'Carrying on', icon: 'draft' },
  titles: { label: 'Naming it', icon: 'book' },
  ask: { label: 'Ask AI', icon: 'activity' },
};

const FAILURE_LABEL: Record<string, string> = {
  auth: 'Key rejected',
  credit: 'No credit',
  rate_limit: 'Rate limited',
  overloaded: 'Overloaded',
  timeout: 'Timed out',
  unreachable: 'Unreachable',
  refused: 'Refused',
};

/*
 * Billing.
 *
 * The design this follows had two things on it that cannot be true. A
 * "credit balance" card — Anthropic exposes no way to read the balance,
 * so any figure there would be invented. And a "billing history" of
 * top-ups — same problem: their console knows what was paid in, and we
 * do not. Both are replaced with what is actually known: what has been
 * spent to date, and the calls themselves. A page with the word billing
 * on it is believed, so it is held to what it can prove.
 *
 * Everything else is the House's own ledger: every call, what it was
 * for, which story, who asked, and what it cost at the published rates.
 * Anthropic's console has the authoritative total and has never heard of
 * a story, which is the whole reason this page exists.
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

  const words = (tokens: number) => Math.round(tokens * 0.75);
  const rangeHref = (d: number) =>
    (d === 30 ? '/admin/settings/billing' : `/admin/settings/billing?days=${d}`) as Route;

  const attention = health.state !== 'working';
  const bannerTone =
    health.state === 'rejected' || health.state === 'unreachable'
      ? 'border-state-danger/40 bg-state-danger/5'
      : attention
        ? 'border-gold/40 bg-gold/5'
        : 'border-rule bg-ink-raised';
  const bannerIcon =
    health.state === 'working'
      ? 'bg-state-success/10 text-state-success'
      : health.state === 'rejected' || health.state === 'unreachable'
        ? 'bg-state-danger/10 text-state-danger'
        : 'bg-gold/10 text-gold';

  const stats = [
    {
      key: 'lifetime',
      icon: 'card',
      label: 'Spent to date',
      value: formatMicros(report.lifetime.costMicros),
      hint: report.lifetime.firstCall
        ? `Since ${formatDate(report.lifetime.firstCall)}`
        : 'The balance itself lives at Anthropic',
    },
    {
      key: 'period',
      icon: 'calendar',
      label: `Last ${days} days`,
      value: formatMicros(report.totals.costMicros),
      hint: 'Estimated usage',
    },
    {
      key: 'calls',
      icon: 'activity',
      label: 'API calls',
      value: report.totals.calls.toLocaleString(),
      hint: report.totals.failed > 0 ? `${report.totals.failed} failed` : 'None failed',
      danger: report.totals.failed > 0,
    },
    {
      key: 'tokens',
      icon: 'layers',
      label: 'Output tokens',
      value: report.totals.outputTokens.toLocaleString(),
      hint: `≈ ${words(report.totals.outputTokens).toLocaleString()} words generated`,
    },
  ];

  const th = 'px-4 py-2.5 text-left font-ui text-micro font-normal uppercase tracking-[0.12em] text-grey-faint';
  const tdNum = 'px-4 py-3 text-right font-ui text-sm tabular-nums';

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6">
        <h2 className="font-display text-3xl font-light leading-tight text-ivory">Billing</h2>
        <p className="mt-1.5 font-ui text-sm text-grey-muted">
          Manage your credit, AI usage and spending.
        </p>
      </div>

      {/* ---- Is it working? ------------------------------------------ */}
      <section className={`mb-6 rounded-lg border px-5 py-5 ${bannerTone}`}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bannerIcon}`}>
              <Icon name={health.state === 'working' ? 'spark' : 'alert'} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-ui text-base font-medium text-ivory">{health.headline}</p>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-grey-muted">{health.detail}</p>
              <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-ui text-xs text-grey-faint">
                <span>Using <span className="text-grey-muted">{health.model}</span></span>
                <span aria-hidden="true">•</span>
                <span>${health.rate.input} / 1M input tokens</span>
                <span aria-hidden="true">•</span>
                <span>${health.rate.output} / 1M output tokens</span>
                {health.keyTail && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="font-mono">key {health.keyTail}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <a
            href={CONSOLE_BILLING}
            target="_blank"
            rel="noreferrer noopener"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-gold px-5 py-3 font-ui text-sm font-medium text-ink transition-colors hover:bg-gold-soft"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            {health.state === 'no_credit' ? 'Top up credit' : 'Manage at Anthropic'}
          </a>
        </div>
      </section>

      {/* ---- The numbers --------------------------------------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-lg border border-rule bg-ink-raised p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <Icon name={s.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="font-ui text-xs text-grey-muted">{s.label}</span>
            </div>
            <p className="font-display text-3xl leading-none text-ivory sm:text-[2.5rem]">{s.value}</p>
            <p className={`mt-3 flex items-center gap-1.5 font-ui text-xs ${s.danger ? 'text-grey-muted' : 'text-grey-muted'}`}>
              {s.danger && <span className="h-2 w-2 rounded-full border border-state-danger" aria-hidden="true" />}
              {s.hint}
            </p>
          </div>
        ))}
      </div>

      {/* ---- Usage, over time and by feature or person --------------- */}
      <div className="mb-6 grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel
            title="Usage"
            hint="Your spending over time"
            aside={
              <div className="flex gap-1">
                {[7, 30, 90].map((d) => (
                  <Link
                    key={d}
                    href={rangeHref(d)}
                    aria-current={d === days ? 'page' : undefined}
                    className={`rounded-md px-3 py-1.5 font-ui text-xs transition-colors ${
                      d === days
                        ? 'bg-gold/15 text-gold'
                        : 'text-grey-muted hover:text-ivory'
                    }`}
                  >
                    {d} days
                  </Link>
                ))}
              </div>
            }
          >
            <div className="px-5 pb-5 pt-6">
              <SpendChart id="billing-daily" days={days} byDay={report.byDay} />
            </div>
          </Panel>
        </div>

        {/*
          One table, wide enough for its four columns, with a select to
          choose the grouping. Two tables side by side each got a third of
          the row, and four columns do not fit in a third of a row.
        */}
        <div className="xl:col-span-5">
          <UsageBreakdown
            features={Object.entries(JOBS).map(([job, meta]) => {
              const row = report.byJob.find((j) => j.job === job);
              return {
                key: job,
                label: meta.label,
                icon: meta.icon,
                calls: row?.calls ?? 0,
                tokens: row?.outputTokens ?? 0,
                cost: formatMicros(row?.costMicros ?? 0),
              };
            })}
            people={report.byAuthor.map((a) => ({
              key: a.email,
              label: a.email,
              avatarName: a.email,
              calls: a.calls,
              tokens: a.outputTokens,
              cost: formatMicros(a.costMicros),
            }))}
          />
        </div>
      </div>

      {/* ---- Stories, and the calls themselves ----------------------- */}
      <div className="mb-6 grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Panel title="Story usage" hint="Which stories the assistant was used on">
            {report.byStory.length === 0 ? (
              <p className="px-5 py-10 text-center font-ui text-xs leading-relaxed text-grey-muted">
                Nothing is attributed to a story yet. Anything asked for from the
                Writing Room with a story open is counted here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem]">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className={th}>Story</th>
                      <th className={`${th} text-right`}>Calls</th>
                      <th className={`${th} text-right`}>Tokens</th>
                      <th className={`${th} text-right`}>Cost</th>
                      <th className={th}>Status</th>
                      <th className={th}><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {report.byStory.map((s) => {
                      const allFailed = s.failed > 0 && s.failed === s.calls;
                      const someFailed = s.failed > 0 && !allFailed;
                      return (
                        <tr key={s.slug} className="hover:bg-ink-hover">
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-3">
                              <Thumb src={s.coverImage} title={s.title} />
                              <Link
                                href={`/admin/stories/${s.slug}` as Route}
                                className="font-ui text-sm text-ivory transition-colors hover:text-gold"
                              >
                                {s.title}
                              </Link>
                            </span>
                          </td>
                          <td className={`${tdNum} text-grey-muted`}>{s.calls}</td>
                          <td className={`${tdNum} text-grey-muted`}>{s.outputTokens.toLocaleString()}</td>
                          <td className={`${tdNum} text-ivory`}>{formatMicros(s.costMicros)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${
                                allFailed
                                  ? 'bg-state-danger/15 text-state-danger'
                                  : someFailed
                                    ? 'bg-gold/15 text-gold'
                                    : 'bg-state-success/15 text-state-success'
                              }`}
                            >
                              {allFailed ? 'Failed' : someFailed ? 'Partly failed' : 'OK'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/stories/${s.slug}` as Route}
                              aria-label={`Open ${s.title}`}
                              className="inline-flex text-grey-faint transition-colors hover:text-ivory"
                            >
                              <Icon name="chevron" className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="xl:col-span-5">
          <Panel
            title="Recent activity"
            hint="The last few calls, newest first"
            action={{ href: '/admin/settings/audit', label: 'Audit log' }}
          >
            {report.recent.length === 0 ? (
              <p className="px-5 py-10 text-center font-ui text-xs leading-relaxed text-grey-muted">
                No calls yet.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rule">
                    <th className={th}>Date</th>
                    <th className={th}>What</th>
                    <th className={`${th} text-right`}>Cost</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {report.recent.map((r, i) => (
                    <tr key={`${r.at}-${i}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-ui text-xs text-grey-muted">
                        {formatDate(r.at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-ui text-sm text-ivory">
                          {JOBS[r.job]?.label ?? r.job}
                        </span>
                        {r.storyTitle && (
                          <span className="block truncate font-ui text-micro text-grey-faint">
                            {r.storyTitle}
                          </span>
                        )}
                      </td>
                      <td className={`${tdNum} text-ivory`}>{formatMicros(r.costMicros)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${
                            r.ok
                              ? 'bg-state-success/15 text-state-success'
                              : 'bg-state-danger/15 text-state-danger'
                          }`}
                        >
                          {r.ok ? 'OK' : FAILURE_LABEL[r.failureKind ?? ''] ?? 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>

      {/* ---- Developer information ----------------------------------- */}
      <details className="group rounded-lg border border-rule bg-ink-raised">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-3">
            <Icon name="code" className="h-4 w-4 text-gold" />
            <span>
              <span className="block font-ui text-sm text-ivory">Developer information</span>
              <span className="block font-ui text-micro text-grey-faint">Technical details about the AI integration</span>
            </span>
          </span>
          <Icon name="chevron" className="h-4 w-4 text-grey-faint transition-transform group-open:rotate-90" />
        </summary>

        <dl className="grid gap-x-8 gap-y-3 border-t border-rule px-5 py-5 font-ui text-sm sm:grid-cols-2">
          <Row k="Provider" v="Anthropic, over the Messages API — no SDK" />
          <Row k="Model" v={health.model} mono />
          <Row k="Key" v={health.keyTail ?? 'not set'} mono />
          <Row k="Key source" v="Parameter Store /soulfables/production/AI_API_KEY on the server; .env.local locally" />
          <Row k="Rates used" v={`$${health.rate.input} in / $${health.rate.output} out per 1M tokens${health.rate.known ? '' : ' (model unknown — Opus rates assumed)'}`} />
          <Row k="Per-call timeout" v="60 seconds" />
          <Row k="What is recorded" v="Every call: feature, model, story, who asked, tokens in and out, duration, and the provider's error verbatim on failure" />
          <Row k="Health check" v="GET /v1/models — authenticates the key, spends no tokens, cannot see the balance" />
        </dl>

        <p className="border-t border-rule px-5 py-4 font-ui text-micro leading-relaxed text-grey-faint">
          Figures here are the House's own estimate from published rates and
          will differ from the invoice — caching and rate changes both move it.{' '}
          <a href={CONSOLE_COST} target="_blank" rel="noreferrer noopener" className="text-gold transition-colors hover:text-gold-soft">
            Anthropic's cost page
          </a>{' '}
          is what is actually owed. Anthropic has no API for buying credit or
          reading the balance, so topping up is always a trip to their console.
          Reader payments are a separate thing and are not built.
        </p>
      </details>
    </>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-ui text-micro uppercase tracking-[0.12em] text-grey-faint">{k}</dt>
      <dd className={`mt-0.5 break-words text-grey ${mono ? 'font-mono text-xs' : ''}`}>{v}</dd>
    </div>
  );
}

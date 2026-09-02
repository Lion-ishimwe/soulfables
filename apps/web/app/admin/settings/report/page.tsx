import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { getReport } from '@/lib/report';
import { AdminPageHeader, Panel, PanelEmpty, StatusDot } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { AreaChart } from '@/components/admin/charts';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Report' };
export const dynamic = 'force-dynamic';

/**
 * The report — what the House has done, and who is here.
 *
 * Analytics and Readers joined, because they were answering halves of one
 * question and neither was answering it truthfully: both pages rendered
 * fixtures in live mode as well as demo, so the House had invented
 * traffic and seven invented readers with invented names.
 *
 * Everything here is queried. Where nothing has happened yet it says so
 * rather than drawing a shape where a number would go.
 */
export default async function ReportPage() {
  await requireStaff();
  const report = await getReport(30);

  const money = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: report.currency,
      minimumFractionDigits: 2,
    }).format(cents / 100);

  const stats = [
    { label: 'Stories opened', value: report.opens.toLocaleString(), hint: 'Last 30 days' },
    { label: 'Finished', value: report.finished.toLocaleString(), hint: 'Lifetime, all stories' },
    { label: 'Purchases', value: report.purchases.toLocaleString(), hint: 'Last 30 days' },
    { label: 'Taken', value: money(report.revenue), hint: 'Last 30 days' },
    { label: 'Readers', value: report.readers.length.toLocaleString(), hint: 'With an account' },
    {
      label: 'Residents',
      value: report.readers.filter((r) => r.plan === 'resident').length.toLocaleString(),
      hint: 'Subscribed now',
    },
  ];

  /*
   * A download beside the thing it downloads, rather than one button at
   * the top exporting some unstated selection. Each is one table, which
   * is what a CSV is.
   */
  const Download = ({ part, label }: { part: string; label: string }) => (
    <a
      href={`/admin/settings/report/download?part=${part}`}
      download
      className="shrink-0 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
    >
      {label}
    </a>
  );

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-rule bg-ink-raised p-4 sm:p-5">
            <p className="font-ui text-xs text-grey-muted">{s.label}</p>
            <p className="mt-2 font-display text-3xl leading-none text-ivory">{s.value}</p>
            <p className="mt-2 font-ui text-xs text-grey-faint">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <Panel
          title="Stories opened"
          hint="Daily, last 30 days"
          aside={<Download part="opens" label="Download CSV" />}
        >
          {report.opens === 0 ? (
            <PanelEmpty>
              Nothing recorded yet. An open is counted the first time somebody
              reads a story, so this fills in as readers arrive.
            </PanelEmpty>
          ) : (
            <div className="px-5 pb-5 pt-6">
              <AreaChart id="report-opens" points={report.daily} metricLabel="Opens" />
            </div>
          )}
        </Panel>
      </div>

      <div className="mb-6">
        <Panel
          title="Most read"
          hint="Lifetime opens and completions"
          aside={<Download part="stories" label="Download CSV" />}
        >
          {report.topStories.length === 0 ? (
            <PanelEmpty>Nothing published yet.</PanelEmpty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem]">
                <thead>
                  <tr className="border-b border-rule text-left font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                    <th className="px-5 py-3 font-normal">Story</th>
                    <th className="w-28 px-5 py-3 font-normal">Opens</th>
                    <th className="w-28 px-5 py-3 font-normal">Finished</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topStories.map((s) => (
                    <tr
                      key={s.slug}
                      className="border-b border-rule/60 last:border-0 hover:bg-ink-hover"
                    >
                      <td className="px-5 py-3 font-ui text-sm text-ivory">{s.title}</td>
                      <td className="px-5 py-3 font-ui text-sm tabular-nums text-ivory">
                        {s.opens.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-ui text-sm tabular-nums text-grey-muted">
                        {s.finished.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Readers, which used to be its own page ----------------- */}
      <Panel
        title="Readers"
        hint="Everyone with an account"
        aside={<Download part="readers" label="Download CSV" />}
      >
        {!report.live ? (
          <PanelEmpty>
            Demo mode has no accounts. Connect a database to see who is here.
          </PanelEmpty>
        ) : report.readers.length === 0 ? (
          <PanelEmpty>Nobody has signed up yet.</PanelEmpty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem]">
              <thead>
                <tr className="border-b border-rule text-left font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
                  <th className="px-5 py-3 font-normal">Name</th>
                  <th className="px-5 py-3 font-normal">Email</th>
                  <th className="px-5 py-3 font-normal">Role</th>
                  <th className="px-5 py-3 font-normal">Tier</th>
                  <th className="w-24 px-5 py-3 font-normal">Read</th>
                  <th className="w-32 px-5 py-3 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody>
                {report.readers.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-rule/60 last:border-0 hover:bg-ink-hover"
                  >
                    <td className="px-5 py-3 font-ui text-sm text-ivory">
                      {r.displayName ?? <span className="text-grey-faint">—</span>}
                    </td>
                    <td className="px-5 py-3 font-ui text-xs text-grey-muted">{r.email}</td>
                    <td className="px-5 py-3 font-ui text-sm capitalize text-grey">{r.role}</td>
                    <td className="px-5 py-3">
                      {r.plan === 'resident' ? (
                        <StatusDot tone="active" label="Resident" />
                      ) : (
                        <StatusDot tone="none" label="Free" />
                      )}
                    </td>
                    <td className="px-5 py-3 font-ui text-sm tabular-nums text-grey-muted">
                      {r.storiesRead}
                    </td>
                    <td className="px-5 py-3 font-ui text-xs text-grey-muted">
                      {formatDate(r.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-rule px-5 py-4 font-ui text-micro leading-relaxed text-grey-faint">
          Read counts finished stories, not opened ones — somebody who opened
          forty and finished two has read two.{' '}
          <Link
            href={'/admin/settings/audit' as Route}
            className="text-gold transition-colors hover:text-gold-soft"
          >
            The audit log
          </Link>{' '}
          records what staff changed.
        </p>
      </Panel>
    </>
  );
}

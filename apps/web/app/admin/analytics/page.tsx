import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, Stat } from '@/components/admin/ui';
import {
  DEMO_EVENTS,
  DEMO_DAILY_OPENS,
  DEMO_TOP_STORIES,
} from '@/lib/demo/admin';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

/*
 * Analytics.
 *
 * Brief §25 lists the events; this is where they surface. Deliberately
 * first-party and thin — no third-party pixel, no cross-site identifier,
 * nothing that would need a cookie banner to justify.
 *
 * The number that matters most is completion, not opens. A story people
 * start and abandon is a worse story than one fewer people open and
 * finish, and a dashboard that leads with traffic teaches the wrong
 * instinct.
 */
export default function AnalyticsPage() {
  const opens = DEMO_EVENTS.find((e) => e.name === 'story_opened')?.count ?? 0;
  const completed = DEMO_EVENTS.find((e) => e.name === 'story_completed')?.count ?? 0;
  const purchases = DEMO_EVENTS.find((e) => e.name === 'purchase_completed')?.count ?? 0;
  const checkouts = DEMO_EVENTS.find((e) => e.name === 'checkout_started')?.count ?? 0;

  const completionRate = opens > 0 ? completed / opens : 0;
  const checkoutRate = checkouts > 0 ? purchases / checkouts : 0;

  const peak = Math.max(...DEMO_DAILY_OPENS.map((d) => d.opens));

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="First-party only. No third-party pixels, and nothing that follows a reader off the site."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-10 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Stories opened" value={opens.toLocaleString()} hint="Last 14 days" />
        <Stat
          label="Completion"
          value={`${Math.round(completionRate * 100)}%`}
          hint="Opened, then finished"
        />
        <Stat label="Purchases" value={purchases} hint="Last 14 days" />
        <Stat
          label="Checkout conversion"
          value={`${Math.round(checkoutRate * 100)}%`}
          hint="Started, then paid"
        />
      </div>

      {/* Daily opens. A bar chart drawn in CSS — no library, no payload. */}
      <section className="mb-12 border border-rule p-6">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="sf-eyebrow">Stories opened, daily</h2>
          <p className="font-ui text-xs tabular-nums text-grey-muted">
            peak {peak}
          </p>
        </div>

        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Daily story opens over the last fourteen days">
          {DEMO_DAILY_OPENS.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div
                className="w-full bg-gold/70 transition-colors group-hover:bg-gold"
                style={{ height: `${(d.opens / peak) * 100}%`, minHeight: '2px' }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap font-ui text-xs tabular-nums text-ivory opacity-0 transition-opacity group-hover:opacity-100">
                {d.opens}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between font-ui text-xs text-grey-muted">
          <span>{DEMO_DAILY_OPENS[0]?.day}</span>
          <span>{DEMO_DAILY_OPENS[DEMO_DAILY_OPENS.length - 1]?.day}</span>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="sf-eyebrow mb-4">Most read</h2>
          <div className="overflow-x-auto border border-rule">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="sf-eyebrow px-5 py-3 text-left">Story</th>
                  <th className="sf-eyebrow px-5 py-3 text-right">Opens</th>
                  <th className="sf-eyebrow px-5 py-3 text-right">Finished</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {DEMO_TOP_STORIES.map((s) => (
                  <tr key={s.slug} className="hover:bg-ink-raised">
                    <td className="px-5 py-3 text-ivory">{s.title}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-grey-muted">
                      {s.opens}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-grey-muted">
                          {Math.round(s.completion * 100)}%
                        </span>
                        <span className="h-px w-10 flex-none bg-rule-strong" aria-hidden="true">
                          <span
                            className="block h-px bg-gold"
                            style={{ width: `${s.completion * 100}%` }}
                          />
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="sf-eyebrow mb-4">Events</h2>
          <div className="overflow-x-auto border border-rule">
            <table className="w-full min-w-[20rem] text-sm">
              <tbody className="divide-y divide-rule">
                {DEMO_EVENTS.map((e) => (
                  <tr key={e.name} className="hover:bg-ink-raised">
                    <td className="px-5 py-2.5 text-grey">{e.label}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ivory">
                      {e.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

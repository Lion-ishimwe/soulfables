import type { Metadata } from 'next';
import {
  PageHeader,
  ReadOnlyNotice,
  StatusPill,
  Stat,
} from '@/components/admin/ui';
import { isReadOnly } from '@/lib/admin-data';
import { DEMO_LETTERS } from '@/lib/demo/admin';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Weekly Letter' };
export const dynamic = 'force-dynamic';

/*
 * The Weekly Letter.
 *
 * A publication with an archive rather than a mailing-list integration —
 * which is why sends are recorded per subscriber per issue. "Did they get
 * it?" is answerable here, from the database, rather than in a third
 * party's dashboard that a future developer may not have access to.
 */
export default function LetterAdminPage() {
  const published = DEMO_LETTERS.filter((l) => l.status === 'published');
  const latest = published[0];

  return (
    <>
      <PageHeader
        title="Weekly Letter"
        subtitle="Issues, subscribers, and how each one landed."
        action={{ href: '/admin/letter', label: 'New letter' }}
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-8 grid gap-px bg-rule sm:grid-cols-3">
        <Stat
          label="Subscribers"
          value={latest?.subscribers ?? 0}
          hint="Confirmed, double opt-in"
        />
        <Stat
          label="Last open rate"
          value={latest?.openRate ? `${Math.round(latest.openRate * 100)}%` : '—'}
        />
        <Stat label="Issues" value={published.length} hint="Published" />
      </div>

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Issue</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Title</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Sent to</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Opened</th>
              <th className="sf-eyebrow px-5 py-3 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {DEMO_LETTERS.map((l) => (
              <tr key={l.slug} className="hover:bg-ink-raised">
                <td className="px-5 py-3.5 font-mono text-xs text-gold">
                  Vol {l.volume} · {l.number}
                </td>
                <td className="px-5 py-3.5">
                  <span className="block text-ivory">{l.title}</span>
                  <span className="mt-0.5 block text-xs text-grey-muted">
                    {l.dek}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={l.status} />
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {l.subscribers || '—'}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {l.openRate ? `${Math.round(l.openRate * 100)}%` : '—'}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {formatDate(l.publishedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

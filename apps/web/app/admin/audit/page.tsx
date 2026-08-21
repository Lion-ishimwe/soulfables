import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice } from '@/components/admin/ui';
import { DEMO_AUDIT } from '@/lib/demo/admin';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

/*
 * The audit log.
 *
 * Append-only by policy as well as by convention: no update or delete
 * policy exists for any role, including owner. Anything that changes
 * published content or somebody's access is recorded with who did it,
 * which is the only version of an audit trail worth having.
 */
export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who changed what. Nobody can edit or remove an entry — not even an owner."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Action</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Subject</th>
              <th className="sf-eyebrow px-5 py-3 text-left">By</th>
              <th className="sf-eyebrow px-5 py-3 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {DEMO_AUDIT.map((a, i) => (
              <tr key={i} className="hover:bg-ink-raised">
                <td className="px-5 py-3.5">
                  <code className="text-xs text-gold">{a.action}</code>
                </td>
                <td className="px-5 py-3.5 text-ivory">{a.entity}</td>
                <td className="px-5 py-3.5 text-grey-muted">{a.actor}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {formatDate(a.at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, Stat } from '@/components/admin/ui';
import { DEMO_READERS } from '@/lib/demo/admin';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

/*
 * Readers.
 *
 * Note what is absent: any way to read a journal entry. There is no
 * column for it, no link to one, and no database policy that would grant
 * staff access if someone added one. That is the promise made on the
 * journal page, kept on this side of the House too.
 */
const ROLE_STYLE: Record<string, string> = {
  owner: 'border-gold/45 text-gold',
  admin: 'border-gold/45 text-gold',
  editor: 'border-gold/45 text-gold',
  reader: 'border-rule-strong text-grey-muted',
};

export default function UsersPage() {
  const residents = DEMO_READERS.filter((r) => r.plan === 'resident').length;
  const staff = DEMO_READERS.filter((r) => r.role !== 'reader').length;

  return (
    <>
      <PageHeader
        title="Readers"
        subtitle="Who is in the House. Journal entries are never reachable from here."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-8 grid gap-px bg-rule sm:grid-cols-3">
        <Stat label="Readers" value={DEMO_READERS.length} />
        <Stat label="Residents" value={residents} hint="Paying members" />
        <Stat label="Staff" value={staff} hint="Editor and above" />
      </div>

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Name</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Email</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Role</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Tier</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Stories read</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {DEMO_READERS.map((r) => (
              <tr key={r.email} className="hover:bg-ink-raised">
                <td className="px-5 py-3.5 text-ivory">{r.displayName}</td>
                <td className="px-5 py-3.5 text-grey-muted">{r.email}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`inline-block border px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${ROLE_STYLE[r.role]}`}
                  >
                    {r.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-grey">
                  {r.plan === 'resident' ? 'Resident' : 'Reader'}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {r.storiesRead}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {formatDate(r.joinedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

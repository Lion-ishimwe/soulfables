import type { Metadata } from 'next';
import {
  isReadOnly,
  listAdminLetters,
  letterSubscriberCount,
} from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, EmptyState, StatusPill } from '@/components/admin/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Weekly Letter' };
export const dynamic = 'force-dynamic';

/*
 * The weekly letter.
 *
 * This rendered DEMO_LETTERS — three invented issues with invented send
 * counts and invented open rates — with no branch on whether a database
 * was connected. Open rates in particular are a claim about people who
 * received something, and nothing has ever been sent.
 *
 * It reads letters and letter_sends now. Both are empty: the letter has
 * a schema and no writing surface, and no email provider is connected to
 * send one with. The page says exactly that.
 */
export default async function LetterPage() {
  const [letters, subscribers] = await Promise.all([
    listAdminLetters(),
    letterSubscriberCount(),
  ]);

  return (
    <>
      <PageHeader
        title="The Weekly Letter"
        subtitle="One story, one reflection, every Sunday."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-rule bg-ink-raised p-5">
          <p className="font-ui text-xs text-grey-muted">Letters</p>
          <p className="mt-2 font-display text-3xl leading-none text-ivory">
            {letters.length}
          </p>
        </div>
        <div className="rounded-lg border border-rule bg-ink-raised p-5">
          <p className="font-ui text-xs text-grey-muted">Subscribers</p>
          <p className="mt-2 font-display text-3xl leading-none text-ivory">
            {subscribers}
          </p>
          <p className="mt-2 font-ui text-xs text-grey-faint">Would receive the next one</p>
        </div>
      </div>

      {letters.length === 0 ? (
        <EmptyState
          title="No letters written yet."
          body="The letter has a home in the database and no writing surface yet, and no email provider is connected to send one with. Both are still to build."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Issue</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Title</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Sent to</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {letters.map((l) => (
                <tr key={l.id} className="hover:bg-ink-raised">
                  <td className="whitespace-nowrap px-5 py-3.5 font-ui text-xs text-grey-muted">
                    Vol {l.volume} · {l.number}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="block text-ivory">{l.title}</span>
                    {l.dek && (
                      <span className="mt-0.5 block text-xs text-grey-muted">{l.dek}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill status={l.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {/* Sends, not open rates. An open rate needs tracking
                        pixels the House does not have, and inventing one
                        is what this page used to do. */}
                    {l.sends || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {formatDate(l.sentAt ?? l.publishedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

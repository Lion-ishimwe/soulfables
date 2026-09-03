import type { Metadata } from 'next';
import { isReadOnly, listAdminPrompts } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice, EmptyState, StatusPill } from '@/components/admin/ui';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Journal prompts' };
export const dynamic = 'force-dynamic';

/*
 * Journal prompts.
 *
 * A prompt scheduled for a date is the question everyone sees that day.
 * Unscheduled ones sit in a pool and are chosen by the calendar date, so
 * the question is stable for the whole day rather than reshuffling on
 * every page load — a question that changes while you are deciding how to
 * answer it is not really being asked.
 *
 * "Entries written" counts uses of the prompt. It is a fact about the
 * prompt, not about any person, and no entry is reachable from here.
 *
 * This page rendered a hard-coded DEMO_PROMPTS array, with no branch on
 * whether a database was connected — so it showed five invented questions
 * with invented use counts while the ten real prompts sat unread in the
 * table beside it.
 */
export default async function PromptsPage() {
  const prompts = await listAdminPrompts();

  return (
    <>
      <PageHeader
        title="Journal prompts"
        subtitle="The question of the day, and the pool it is drawn from."
      />

      {isReadOnly() && <ReadOnlyNotice />}

      {prompts.length === 0 ? (
        <EmptyState
          title="No prompts yet."
          body="A prompt scheduled for a date is the question everyone sees that day. Unscheduled ones sit in a pool and are drawn from by the calendar."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Question</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Kind</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Scheduled</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Entries written</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {prompts.map((p) => (
                <tr key={p.id} className="hover:bg-ink-raised">
                  <td className="px-5 py-3.5 font-display text-lg italic text-ivory">
                    {p.body}
                    {!p.isActive && (
                      <span className="ml-3 align-middle">
                        <StatusPill status="archived" />
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 capitalize text-grey-muted">{p.kind}</td>
                  <td className="px-5 py-3.5 text-grey-muted">
                    {p.scheduledOn ? (
                      formatDate(p.scheduledOn)
                    ) : (
                      <span className="text-xs text-grey-faint">In the pool</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                    {p.uses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 font-ui text-xs leading-relaxed text-grey-faint">
        Prompts are seeded with the taxonomy. Writing them from here is not
        built yet — the list is read-only, and says so rather than offering a
        button that does nothing.
      </p>
    </>
  );
}

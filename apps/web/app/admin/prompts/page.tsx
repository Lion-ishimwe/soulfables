import type { Metadata } from 'next';
import { isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice } from '@/components/admin/ui';
import { DEMO_PROMPTS } from '@/lib/demo/admin';

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
 */
export default function PromptsPage() {
  return (
    <>
      <PageHeader
        title="Journal prompts"
        subtitle="The question of the day, and the pool it is drawn from."
        action={{ href: '/admin/prompts', label: 'New prompt' }}
      />

      {isReadOnly() && <ReadOnlyNotice />}

      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="sf-eyebrow px-5 py-3 text-left">Question</th>
              <th className="sf-eyebrow px-5 py-3 text-left">Kind</th>
              <th className="sf-eyebrow px-5 py-3 text-right">Entries written</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {DEMO_PROMPTS.map((p) => (
              <tr key={p.body} className="hover:bg-ink-raised">
                <td className="px-5 py-3.5 font-display text-lg italic text-ivory">
                  {p.body}
                </td>
                <td className="px-5 py-3.5 text-grey-muted">{p.kind}</td>
                <td className="px-5 py-3.5 text-right tabular-nums text-grey-muted">
                  {p.uses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

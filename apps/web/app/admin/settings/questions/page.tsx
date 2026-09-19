import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { listAdminCards } from '@/lib/questions';
import { AdminPageHeader, StatusDot } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { QuestionForm } from '@/components/admin/question-form';
import { deleteAffirmation, deleteCard, setAffirmationActive, setCardActive } from '@/app/actions/questions';
import { listAdminAffirmations } from '@/lib/affirmations';
import { AffirmationForm } from '@/components/admin/affirmation-form';

export const metadata: Metadata = { title: 'Questions' };
export const dynamic = 'force-dynamic';

/**
 * Settings → Questions: the drawer of quiet questions, card by card.
 *
 * Every card readers can draw at /questions is a row here. Add one
 * with the form, change one by choosing Edit, put one away when it has
 * had its season. A card that has gathered reflections cannot be
 * deleted — those reflections answered it — only put away.
 */
export default async function QuestionsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; edit?: string; put?: string; back?: string; removed?: string; kept?: string; line?: string }>;
}) {
  await requireStaff();
  const [{ saved, edit, put, back, removed, kept, line }, cards, affirmations] = await Promise.all([
    searchParams,
    listAdminCards(),
    listAdminAffirmations(),
  ]);

  const editing = edit ? (cards.find((c) => c.id === edit) ?? null) : null;
  const inDrawer = cards.filter((c) => c.isActive).length;
  const th = 'px-5 py-3.5 text-left font-normal font-ui text-micro uppercase tracking-[0.14em] text-grey-faint';

  const notice = saved
    ? `“${saved}” is in the drawer.`
    : put
      ? `“${put}” is put away. Nobody will draw it until you bring it back.`
      : back
        ? `“${back}” is back in the drawer.`
        : removed
          ? `“${removed}” is gone.`
          : kept
            ? 'That card has reflections written to it, so it stays. Put it away instead.'
            : null;

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-ivory">The drawer of quiet questions</h2>
          <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">
            The cards readers draw at{' '}
            <Link href={'/questions' as Route} className="text-gold transition-colors hover:text-gold-soft">
              Quiet Questions
            </Link>
            . A reflection written to a card is kept in the reader’s journal against it, and counts
            here as “written”, never as anything a person said.
          </p>
        </div>
        <p className="font-ui text-xs text-grey-muted">
          {cards.length === 0
            ? 'The drawer is empty.'
            : `${inDrawer} of ${cards.length} ${cards.length === 1 ? 'card is' : 'cards are'} in the drawer.`}
        </p>
      </div>

      {notice && (
        <p aria-live="polite" className={`mb-6 rounded border-l-2 px-4 py-3 font-ui text-sm text-ivory ${kept ? 'border-gold bg-gold-dim' : 'border-state-success bg-state-success/10'}`}>
          {notice}
        </p>
      )}

      {isDemoMode() && (
        <p className="mb-6 rounded border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          The demo shows the twelve cards from the first House and keeps them as they are.
        </p>
      )}

      <div className="space-y-8">
        <QuestionForm key={editing?.id ?? 'new'} card={editing} readOnly={isDemoMode()} />

        <div className="overflow-x-auto rounded-lg border border-rule bg-ink-raised">
          <table className="w-full min-w-[40rem]">
            <thead>
              <tr className="border-b border-rule">
                <th className={th}>Card</th>
                <th className={`${th} w-28`}>Feeling</th>
                <th className={`${th} w-24 text-right`}>Written</th>
                <th className={`${th} w-28`}>In the drawer</th>
                <th className={`${th} w-44`}>
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cards.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center font-ui text-sm text-grey-muted">
                    No cards yet. Write the first one above.
                  </td>
                </tr>
              )}
              {cards.map((c) => (
                <tr
                  key={c.id}
                  className={`border-b border-rule transition-colors last:border-0 hover:bg-ink-hover ${editing?.id === c.id ? 'bg-ink-hover' : ''}`}
                >
                  <td className="px-5 py-4">
                    <span className="block font-display text-base text-ivory">{c.title}</span>
                    <span className="mt-0.5 block font-display text-sm italic text-grey-muted">{c.body}</span>
                  </td>
                  <td className="px-5 py-4 font-ui text-sm text-grey">{c.feeling}</td>
                  <td className="px-5 py-4 text-right font-ui text-sm tabular-nums text-grey-muted">{c.uses}</td>
                  <td className="px-5 py-4">
                    {c.isActive ? <StatusDot tone="active" label="Yes" /> : <StatusDot tone="idle" label="Put away" />}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/settings/questions?edit=${c.id}` as Route}
                        className="whitespace-nowrap border border-gold/50 px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
                      >
                        Edit
                      </Link>
                      <form action={setCardActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={c.isActive ? '0' : '1'} />
                        <button
                          type="submit"
                          disabled={isDemoMode()}
                          className="whitespace-nowrap border border-rule px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-grey-muted transition-all hover:border-gold/50 hover:text-ivory disabled:opacity-50"
                        >
                          {c.isActive ? 'Put away' : 'Bring back'}
                        </button>
                      </form>
                      {c.uses === 0 && (
                        <form action={deleteCard}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            disabled={isDemoMode()}
                            aria-label={`Delete ${c.title}`}
                            className="whitespace-nowrap border border-rule px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-grey-muted transition-all hover:border-state-danger/60 hover:text-ivory disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="font-ui text-xs leading-relaxed text-grey-faint">
          A card with reflections written to it cannot be deleted, because those reflections
          answered it. Put it away and it stays out of the drawer while the journal keeps its
          question.
        </p>
      </div>

      {/* ---- Affirmations ------------------------------------------- */}
      <div className="mt-14 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-ivory">Affirmations</h2>
          <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">
            One calm line a day, shown in the Reading Room and offered by the Librarian. The day
            picks one from the rotation, the same for everyone until midnight.
          </p>
        </div>
        <p className="font-ui text-xs text-grey-muted">
          {affirmations.filter((a) => a.isActive).length} of {affirmations.length} in the rotation.
        </p>
      </div>

      {line && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          {line === 'added' ? 'Added to the rotation.' : line === 'put' ? 'Put away.' : line === 'back' ? 'Back in the rotation.' : 'Gone.'}
        </p>
      )}

      <div className="space-y-8">
        <AffirmationForm readOnly={isDemoMode()} />
        <div className="overflow-x-auto rounded-lg border border-rule bg-ink-raised">
          <table className="w-full min-w-[32rem]">
            <thead>
              <tr className="border-b border-rule">
                <th className={th}>Line</th>
                <th className={`${th} w-32`}>In rotation</th>
                <th className={`${th} w-44`}>
                  <span className="sr-only">Change</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {affirmations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center font-ui text-sm text-grey-muted">
                    No lines yet. Write the first one above.
                  </td>
                </tr>
              )}
              {affirmations.map((a) => (
                <tr key={a.id} className="border-b border-rule transition-colors last:border-0 hover:bg-ink-hover">
                  <td className="px-5 py-4 font-display text-base italic text-ivory">{a.body}</td>
                  <td className="px-5 py-4">
                    {a.isActive ? <StatusDot tone="active" label="Yes" /> : <StatusDot tone="idle" label="Put away" />}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <form action={setAffirmationActive}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="active" value={a.isActive ? '0' : '1'} />
                        <button
                          type="submit"
                          disabled={isDemoMode()}
                          className="whitespace-nowrap border border-rule px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-grey-muted transition-all hover:border-gold/50 hover:text-ivory disabled:opacity-50"
                        >
                          {a.isActive ? 'Put away' : 'Bring back'}
                        </button>
                      </form>
                      <form action={deleteAffirmation}>
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          type="submit"
                          disabled={isDemoMode()}
                          aria-label="Delete this line"
                          className="whitespace-nowrap border border-rule px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] text-grey-muted transition-all hover:border-state-danger/60 hover:text-ivory disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

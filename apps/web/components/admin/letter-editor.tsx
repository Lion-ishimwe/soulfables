'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteLetter, republishLetter, saveLetter, sendLetterTest, sendLetterToSubscribers, unpublishLetter, type LetterResult } from '@/app/actions/letters';
import type { Letter } from '@/lib/letters';

const btn = 'border px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] transition-all disabled:opacity-50';
const gold = `${btn} border-gold/50 text-gold hover:bg-gold hover:text-ink`;
const soft = `${btn} border-rule text-grey-muted hover:border-gold/50 hover:text-ivory`;
const danger = `${btn} border-rule text-grey-muted hover:border-state-danger/60 hover:text-ivory`;
const FIELD = 'w-full border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/60';
const LABEL = 'sf-eyebrow mb-2 block';
const HINT = 'mt-1.5 font-ui text-xs text-grey-muted';

function Notice({ state }: { state: LetterResult }) {
  if (state.error)
    return (
      <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p aria-live="polite" className="mb-5 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
        {state.message}
      </p>
    );
  return null;
}

function Busy({ idle, busy, className }: { idle: string; busy: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? busy : idle}
    </button>
  );
}

/**
 * Where the letter is written and sent.
 *
 * Three forms on one page: the letter itself, a test to yourself, and
 * the send to everyone. The last asks once before it goes, because a
 * letter cannot be unsent.
 */
export function LetterEditor({
  letter,
  stories,
  subscribers,
  emailReady,
  saved,
}: {
  letter: Letter | null;
  stories: { id: string; title: string }[];
  subscribers: number;
  emailReady: boolean;
  saved?: boolean;
}) {
  const [saveState, saveAction] = useActionState<LetterResult, FormData>(saveLetter, saved ? { message: 'Saved.' } : {});
  const [testState, testAction] = useActionState<LetterResult, FormData>(sendLetterTest, {});
  const [sendState, sendAction] = useActionState<LetterResult, FormData>(sendLetterToSubscribers, {});
  const [downState, downAction] = useActionState<LetterResult, FormData>(unpublishLetter, {});
  const [upState, upAction] = useActionState<LetterResult, FormData>(republishLetter, {});
  const [delState, delAction] = useActionState<LetterResult, FormData>(deleteLetter, {});
  const sent = letter?.status === 'published';
  const down = letter?.status === 'archived';

  return (
    <div className="space-y-6">
      <form action={saveAction} className="rounded-lg border border-rule bg-ink-raised p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <p className="sf-eyebrow">{letter ? `Vol ${letter.volume} · No. ${letter.number}` : 'A new letter'}</p>
          <Link href={'/admin/letter' as Route} className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory">
            ← All letters
          </Link>
        </div>
        <Notice state={saveState} />
        {letter && <input type="hidden" name="id" value={letter.id} />}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="l-title" className={LABEL}>Title <span className="text-gold">*</span></label>
            <input id="l-title" name="title" required maxLength={200} defaultValue={letter?.title ?? ''} className={`${FIELD} font-display text-xl`} />
            <p className={HINT}>Shown at the top of the letter and on the site.</p>
          </div>
          <div>
            <label htmlFor="l-subject" className={LABEL}>Email subject</label>
            <input id="l-subject" name="subject" maxLength={200} defaultValue={letter?.subject ?? ''} className={FIELD} />
            <p className={HINT}>What the inbox shows. Empty means the title.</p>
          </div>
          <div>
            <label htmlFor="l-dek" className={LABEL}>Dateline</label>
            <input id="l-dek" name="dek" maxLength={200} defaultValue={letter?.dek ?? ''} className={FIELD} placeholder="The week of 5 October" />
            <p className={HINT}>One line under the title.</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="l-story" className={LABEL}>The story this week</label>
            <select id="l-story" name="featuredStoryId" defaultValue={letter?.featuredStory?.id ?? ''} className={FIELD}>
              <option value="">— none —</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <p className={HINT}>Linked at the end of the letter with a button to read it.</p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="l-body" className={LABEL}>The letter <span className="text-gold">*</span></label>
            <textarea
              id="l-body"
              name="body"
              required
              rows={18}
              maxLength={60000}
              defaultValue={letter?.body ?? ''}
              className={`${FIELD} resize-y font-reading text-base leading-relaxed`}
              placeholder={'Dear reader,\n\nThis week the shelf was Grief…\n\n:: A question for your journal\n\nWhat did you keep?'}
            />
            <p className={HINT}>
              Paragraphs separated by a blank line. A line starting with :: is a heading, &gt; is a quote, **bold**, *italic*, and [a link](https://…).
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
          <p className="font-ui text-xs text-grey-muted">
            {sent
              ? `Sent ${letter?.sentAt ? new Date(letter.sentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : ''}. Edits change the page on the site, not the emails already sent.`
              : down
                ? 'Taken down. Not on the site; emails already sent stay sent.'
                : 'A draft until it is sent.'}
          </p>
          <Busy idle={letter ? 'Save' : 'Save the draft'} busy="Saving…" className={gold} />
        </div>
      </form>

      {letter && (
        <div className="grid gap-6 md:grid-cols-2">
          <form action={testAction} className="rounded-lg border border-rule bg-ink-raised p-6">
            <input type="hidden" name="id" value={letter.id} />
            <h2 className="font-display text-xl text-ivory">Read it in your inbox first</h2>
            <p className="mt-1 font-ui text-xs text-grey-muted">A test copy to your own address, exactly as readers will see it.</p>
            <div className="mt-4"><Notice state={testState} /></div>
            <Busy idle="Send me a test" busy="Sending…" className={soft} />
          </form>

          <form
            action={sendAction}
            onSubmit={(e) => {
              if (!window.confirm(`Send this letter to ${subscribers} ${subscribers === 1 ? 'subscriber' : 'subscribers'}? It cannot be unsent.`)) e.preventDefault();
            }}
            className="rounded-lg border border-gold/40 bg-ink-raised p-6"
          >
            <input type="hidden" name="id" value={letter.id} />
            <h2 className="font-display text-xl text-ivory">{sent ? 'Send to anyone who joined since' : 'Send to subscribers'}</h2>
            <p className="mt-1 font-ui text-xs text-grey-muted">
              {subscribers} confirmed {subscribers === 1 ? 'subscriber' : 'subscribers'}. Each is written to once; running this again reaches only those who have not had it.
              {!emailReady && ' No email service is connected, so nothing can go out yet.'}
            </p>
            <div className="mt-4"><Notice state={sendState} /></div>
            <Busy idle={sent ? 'Send to new subscribers' : 'Send the letter'} busy="Sending…" className={gold} />
            {sent && (
              <p className="mt-3 font-ui text-xs">
                <a href={`/letter/${letter.slug}`} target="_blank" rel="noreferrer" className="text-gold hover:text-gold-soft">Read it on the site →</a>
              </p>
            )}
          </form>
        </div>
      )}

      {letter && (
        <div className="rounded-lg border border-rule p-6">
          <h2 className="font-display text-xl text-ivory">Taking it back</h2>
          <p className="mt-1 font-ui text-xs text-grey-muted">
            Unpublishing removes the letter from the site; what was emailed has been emailed. Deleting removes it and its send records for good.
          </p>
          <div className="mt-4 space-y-3">
            <Notice state={downState} />
            <Notice state={upState} />
            <Notice state={delState} />
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            {sent && (
              <form action={downAction}>
                <input type="hidden" name="id" value={letter.id} />
                <Busy idle="Unpublish" busy="Taking down…" className={danger} />
              </form>
            )}
            {down && (
              <form action={upAction}>
                <input type="hidden" name="id" value={letter.id} />
                <Busy idle="Publish again" busy="Putting back…" className={soft} />
              </form>
            )}
            <form action={delAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={letter.id} />
              <label className="block">
                <span className={LABEL}>Type delete to confirm</span>
                <input name="confirm" autoComplete="off" className={`${FIELD} w-40`} placeholder="delete" />
              </label>
              <Busy idle="Delete the letter" busy="Deleting…" className={danger} />
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

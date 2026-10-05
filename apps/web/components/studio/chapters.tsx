'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { publishChapter, removeChapter, saveChapter, type WorkflowResult } from '@/app/actions/workflow';
import { KebabMenu } from '@/components/admin/kebab-menu';
import type { WorkStory } from '@/lib/admin-data';
import { ChapterTrack } from './chapter-track';

const btn = 'border px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] transition-all disabled:opacity-50';
const gold = `${btn} border-gold/50 text-gold hover:bg-gold hover:text-ink`;
const soft = `${btn} border-rule text-grey transition-all hover:border-gold/50 hover:text-gold`;

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={gold}>
      {pending ? 'Saving…' : isNew ? 'Save the chapter' : 'Save'}
    </button>
  );
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * Writing a serial, chapter by chapter.
 *
 * Two doors at the top. "Continue writing" opens the chapter the writer
 * was last in: the draft touched most recently, or whichever chapter
 * this browser had open. "New chapter" opens a blank one with the next
 * number. Any chapter in the list can be opened and rewritten; a
 * released one too, which changes what readers see.
 *
 * The open chapter is remembered per story in this browser, so coming
 * back after a week lands in the same place.
 */
export function Chapters({ story, canPublish }: { story: WorkStory; canPublish: boolean }) {
  const [state, action] = useActionState<WorkflowResult, FormData>(saveChapter, {});
  const chapters = useMemo(() => [...story.chapters].sort((a, b) => a.number - b.number), [story.chapters]);
  const nextNumber = chapters.reduce((n, c) => Math.max(n, c.number), 0) + 1;
  const storageKey = `sf-chapter:${story.slug}`;

  // Which chapter is open: a number, or 'new'. Null is the closed state.
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Where they left off, remembered by this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && chapters.some((c) => String(c.number) === saved)) setOpen(Number(saved));
    } catch {
      /* no storage, no memory: the buttons still work */
    }
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (typeof open === 'number') localStorage.setItem(storageKey, String(open));
    } catch {
      /* ignore */
    }
  }, [open, storageKey]);

  // After a new chapter is saved it exists in the list; keep it open by number.
  useEffect(() => {
    if (state.message && open === 'new') setOpen(nextNumber - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.message]);

  const drafts = chapters.filter((c) => c.status !== 'published');
  const latestDraft = [...drafts].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || b.number - a.number)[0] ?? null;

  function continueWriting() {
    setOpen(latestDraft ? latestDraft.number : 'new');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  function newChapter() {
    setOpen('new');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const current = typeof open === 'number' ? (chapters.find((c) => c.number === open) ?? null) : null;
  const isNew = open === 'new';
  const showForm = isNew || current !== null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="sf-eyebrow">Chapters</h2>
        <div className="flex flex-wrap gap-3">
          {chapters.length > 0 && (
            <button type="button" onClick={continueWriting} className={soft}>
              {latestDraft ? `Continue writing · chapter ${latestDraft.number}` : 'Continue writing'}
            </button>
          )}
          <button type="button" onClick={newChapter} className={gold}>
            New chapter {nextNumber}
          </button>
        </div>
      </div>

      <div className="mb-5">
        <ChapterTrack chapters={chapters} />
      </div>

      {chapters.length > 0 && (
        <ul className="mb-5 divide-y divide-rule border border-rule">
          {chapters.map((c) => {
            const isOpen = open === c.number;
            return (
              <li key={c.id} className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 ${isOpen ? 'bg-ink-raised' : ''}`}>
                <button type="button" onClick={() => setOpen(c.number)} className="min-w-0 flex-1 text-left">
                  <span className="block text-ivory">
                    <span className="font-mono text-xs text-gold">{String(c.number).padStart(2, '0')}</span> {c.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-grey-muted">
                    {c.status === 'published' ? 'Released' : 'Not out yet'} · {words(c.bodyMdx).toLocaleString()} words
                    {isOpen ? ' · open below' : ' · click to open'}
                  </span>
                </button>
                <KebabMenu
                  label={`Chapter ${c.number}`}
                  items={[
                    ...(canPublish && c.status !== 'published'
                      ? [{ kind: 'action' as const, label: 'Release this chapter', action: publishChapter, fields: { storySlug: story.slug, id: c.id } }]
                      : []),
                    {
                      kind: 'action' as const,
                      label: 'Delete chapter',
                      action: removeChapter,
                      fields: { storySlug: story.slug, id: c.id },
                      danger: true,
                      confirm: `Delete chapter ${c.number}?`,
                      confirmBody: `“${c.title}” and everything in it. This cannot be undone.`,
                      confirmWord: 'delete',
                    },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div ref={formRef}>
        {showForm ? (
          <form key={isNew ? 'new' : current!.id} action={action} className="border border-gold/30 bg-ink-raised p-5">
            <input type="hidden" name="storySlug" value={story.slug} />
            {current && <input type="hidden" name="id" value={current.id} />}

            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <p className="sf-eyebrow">{isNew ? `Chapter ${nextNumber}, new` : `Chapter ${current!.number}${current!.status === 'published' ? ' · released, edits change what readers see' : ' · draft'}`}</p>
              <button type="button" onClick={() => setOpen(null)} className="font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory">
                Close
              </button>
            </div>

            {state.error && (
              <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">{state.error}</p>
            )}
            {state.message && (
              <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">{state.message}</p>
            )}

            <div className="mb-4 grid gap-4 sm:grid-cols-[6rem_1fr]">
              <div>
                <label htmlFor="ch-number" className="sf-eyebrow mb-2 block">Number</label>
                <input
                  id="ch-number"
                  name="number"
                  type="number"
                  defaultValue={isNew ? nextNumber : current!.number}
                  min={1}
                  className="w-full border border-rule bg-ink px-3 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label htmlFor="ch-title" className="sf-eyebrow mb-2 block">Title</label>
                <input
                  id="ch-title"
                  name="title"
                  required
                  defaultValue={isNew ? '' : current!.title}
                  placeholder="The House Waits"
                  className="w-full border border-rule bg-ink px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
                />
              </div>
            </div>

            <label htmlFor="ch-body" className="sf-eyebrow mb-2 block">The chapter</label>
            <textarea
              id="ch-body"
              name="bodyMdx"
              rows={22}
              defaultValue={isNew ? '' : current!.bodyMdx}
              placeholder="Write here. A blank line starts a new paragraph."
              className="w-full resize-y border border-rule bg-ink px-4 py-3.5 font-reading text-base leading-relaxed text-grey outline-none placeholder:text-grey-faint focus:border-gold/50"
            />

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Save isNew={isNew} />
              {canPublish && current?.status !== 'published' && (
                <label className="flex items-center gap-2.5 text-sm text-grey">
                  <input type="checkbox" name="publish" className="h-3.5 w-3.5 accent-[#C89528]" />
                  Release it straight away
                </label>
              )}
              <span className="font-ui text-xs text-grey-muted">Save often. Your place is remembered on this device.</span>
            </div>
          </form>
        ) : (
          <p className="border border-rule px-5 py-4 font-ui text-sm text-grey-muted">
            {chapters.length === 0
              ? 'Nothing written yet. Press New chapter 1 to begin.'
              : 'Open a chapter above to keep writing it, or start the next one.'}
          </p>
        )}
      </div>
    </section>
  );
}

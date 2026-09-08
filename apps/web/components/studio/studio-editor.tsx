'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  submitStory,
  saveChapter,
  removeChapter,
  publishChapter,
  type WorkflowResult,
  saveStoryCover,
} from '@/app/actions/workflow';
import { KebabMenu } from '@/components/admin/kebab-menu';
import type { WorkStory } from '@/lib/admin-data';
import { ChapterTrack } from './chapter-track';
import { CoverField } from '@/components/admin/cover-field';
import { Assistant } from './assistant';

function Button({
  label,
  pendingLabel,
  primary,
}: {
  label: string;
  pendingLabel: string;
  primary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] transition-all disabled:opacity-50 ${
        primary
          ? 'border-gold/50 text-gold hover:bg-gold hover:text-ink'
          : 'border-rule text-grey-muted hover:border-ivory/30 hover:text-ivory'
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * An author's view of one story.
 *
 * Two things are deliberately missing: a publish button, and the shelf
 * and access controls. Publishing is the House's decision, and letting an
 * author set "Residents only" would let them price their own work. Both
 * are staff jobs, and this page is honest about that rather than showing
 * a control that would be refused.
 */
export function StudioEditor({
  story,
  canPublish,
  aiAllowed,
}: {
  story: WorkStory;
  canPublish: boolean;
  /** Whether the House has switched the assistant on for this writer. */
  aiAllowed: boolean;
}) {
  const [submitState, submitAction] = useActionState<WorkflowResult, FormData>(
    submitStory,
    {},
  );
  const [coverState, coverAction] = useActionState<WorkflowResult, FormData>(
    saveStoryCover,
    {},
  );
  const [chapterState, chapterAction] = useActionState<WorkflowResult, FormData>(
    saveChapter,
    {},
  );

  const [adding, setAdding] = useState(false);
  const nextNumber =
    story.chapters.reduce((n, c) => Math.max(n, c.number), 0) + 1;

  const canSubmit = story.status === 'draft';

  return (
    <>
      {/* A hand with the writing — only for those the House has given it to. */}
      {aiAllowed && (
        <Assistant
          storySlug={story.slug}
          shelfSlug={story.shelfSlug}
          title={story.title}
          body={story.bodyMdx}
        />
      )}

      {/*
        The cover, for whoever is carrying the story.
        
        The admin has had this field all along; the writing room has not,
        so the person who wrote a story was the one person who could not
        choose its face.
      */}
      <section className="mb-10">
        <h2 className="sf-eyebrow mb-4">Cover</h2>

        <form action={coverAction} className="border border-rule p-5">
          <input type="hidden" name="storySlug" value={story.slug} />

          {coverState.error && (
            <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
              {coverState.error}
            </p>
          )}
          {coverState.message && (
            <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
              {coverState.message}
            </p>
          )}

          <CoverField
            defaultValue={story.coverImage ?? ''}
            title={story.title}
            author={story.authorName ?? ''}
            shelf={story.shelfSlug}
          />

          <div className="mt-5">
            <button
              type="submit"
              className="rounded border border-gold/60 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-colors hover:bg-gold hover:text-ink"
            >
              Save cover
            </button>
          </div>
        </form>
      </section>

      {story.releaseMode === 'serial' && (
        <section className="mb-10">
          <h2 className="sf-eyebrow mb-4">Chapters</h2>

          {/*
            Where the serial has got to, before the list of what it is
            made of. Returning after a fortnight, "released up to 3, next
            is 5" is the thing you need; the rows are for checking it.
          */}
          <div className="mb-5">
            <ChapterTrack chapters={story.chapters} />
          </div>

          {chapterState.error && (
            <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
              {chapterState.error}
            </p>
          )}
          {chapterState.message && (
            <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
              {chapterState.message}
            </p>
          )}

          {story.chapters.length > 0 && (
            <ul className="mb-5 divide-y divide-rule border border-rule">
              {story.chapters.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block text-ivory">
                      <span className="font-mono text-xs text-gold">
                        {String(c.number).padStart(2, '0')}
                      </span>{' '}
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-grey-muted">
                      {c.status === 'published' ? 'Released' : 'Not out yet'}
                      {' · '}
                      {c.bodyMdx.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </span>

                  <KebabMenu
                    label={`Chapter ${c.number}`}
                    items={[
                      ...(canPublish && c.status !== 'published'
                        ? [
                            {
                              kind: 'action' as const,
                              label: 'Release this chapter',
                              action: publishChapter,
                              fields: { storySlug: story.slug, id: c.id },
                            },
                          ]
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
              ))}
            </ul>
          )}

          {adding ? (
            <form action={chapterAction} className="border border-rule p-5">
              <input type="hidden" name="storySlug" value={story.slug} />

              <div className="mb-4 grid gap-4 sm:grid-cols-[6rem_1fr]">
                <div>
                  <label htmlFor="ch-number" className="sf-eyebrow mb-2 block">
                    Number
                  </label>
                  <input
                    id="ch-number"
                    name="number"
                    type="number"
                    defaultValue={nextNumber}
                    min={1}
                    className="w-full border border-rule bg-ink-raised px-3 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
                  />
                </div>
                <div>
                  <label htmlFor="ch-title" className="sf-eyebrow mb-2 block">
                    Title
                  </label>
                  <input
                    id="ch-title"
                    name="title"
                    required
                    placeholder="The House Waits"
                    className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
                  />
                </div>
              </div>

              <label htmlFor="ch-body" className="sf-eyebrow mb-2 block">
                The chapter
              </label>
              <textarea
                id="ch-body"
                name="bodyMdx"
                rows={14}
                className="w-full resize-y border border-rule bg-ink-raised px-4 py-3.5 font-reading text-base leading-relaxed text-grey outline-none focus:border-gold/50"
              />

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button label="Save chapter" pendingLabel="Saving…" primary />
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory"
                >
                  Cancel
                </button>

                {canPublish && (
                  <label className="flex items-center gap-2.5 text-sm text-grey">
                    <input
                      type="checkbox"
                      name="publish"
                      className="h-3.5 w-3.5 accent-[#C89528]"
                    />
                    Release it straight away
                  </label>
                )}
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="border border-rule px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey transition-all hover:border-gold/50 hover:text-gold"
            >
              Add chapter {nextNumber}
            </button>
          )}
        </section>
      )}

      {/* A whole story. */}
      {story.releaseMode === 'full' && (
        <section className="mb-10">
          <h2 className="sf-eyebrow mb-4">The story</h2>
          <div className="border border-rule p-6">
            <p className="whitespace-pre-wrap font-reading text-base leading-relaxed text-grey">
              {story.bodyMdx.slice(0, 1600) || 'Nothing written yet.'}
              {story.bodyMdx.length > 1600 && '…'}
            </p>
            <p className="mt-5 border-t border-rule pt-4 text-xs text-grey-muted">
              {story.bodyMdx.trim().split(/\s+/).filter(Boolean).length.toLocaleString()}{' '}
              words · about {story.readingMinutes} minutes to read.
              {' '}Upload a revised template from the Writing Room to replace it.
            </p>
          </div>
        </section>
      )}

      {/* Send it in. */}
      {canSubmit && (
        <section className="border-t border-rule pt-8">
          {submitState.error && (
            <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
              {submitState.error}
            </p>
          )}
          {submitState.message && (
            <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
              {submitState.message}
            </p>
          )}

          <form action={submitAction} className="flex flex-wrap items-center gap-5">
            <input type="hidden" name="slug" value={story.slug} />
            <Button label="Send to the House" pendingLabel="Sending…" primary />
            <span className="max-w-md text-xs leading-normal text-grey-muted">
              Someone will read it. You will hear either way, and it will not
              appear anywhere until they have.
            </span>
          </form>
        </section>
      )}
    </>
  );
}

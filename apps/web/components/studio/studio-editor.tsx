'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitStory, type WorkflowResult, saveStoryCover } from '@/app/actions/workflow';
import type { WorkStory } from '@/lib/admin-data';
import { Chapters } from './chapters';
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

      {story.releaseMode === 'serial' && <Chapters story={story} canPublish={canPublish} />}

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

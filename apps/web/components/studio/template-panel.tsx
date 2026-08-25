'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  uploadStoryTemplate,
  type WorkflowResult,
} from '@/app/actions/workflow';

function Upload() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Reading it…' : 'Bring it in'}
    </button>
  );
}

/**
 * Download the template, write elsewhere, upload when done.
 *
 * The whole point is that nobody has to compose in a browser text box.
 * The file is plain Markdown, so it opens in anything — and it comes back
 * as a draft, never straight to the library.
 */
export function TemplatePanel() {
  const [state, formAction] = useActionState<WorkflowResult, FormData>(
    uploadStoryTemplate,
    {},
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid gap-px bg-rule sm:grid-cols-2">
      {/* Download */}
      <div className="bg-ink p-7">
        <p className="font-display text-2xl text-ivory">Take the template</p>
        <p className="mt-3 text-sm leading-normal text-grey-muted">
          A plain file with the details block at the top and room for the
          story underneath. Write in whatever you like — it only has to come
          back as text.
        </p>

        <a
          href="/api/story-template"
          download
          className="mt-6 inline-block border border-rule px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey transition-all hover:border-gold/50 hover:text-gold"
        >
          Download the template
        </a>

        <p className="mt-4 text-xs leading-normal text-grey-muted">
          Sections start with <code className="text-gold">::</code>. In a
          serial, each section becomes a chapter.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-ink p-7">
        <p className="font-display text-2xl text-ivory">Bring it back</p>
        <p className="mt-3 text-sm leading-normal text-grey-muted">
          It arrives as a draft. Nothing is published until the House has
          read it.
        </p>

        <form action={formAction} className="mt-6">
          {state.error && (
            <p
              role="alert"
              className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
            >
              {state.error}
            </p>
          )}
          {state.message && (
            <p
              aria-live="polite"
              className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory"
            >
              {state.message}
            </p>
          )}

          <input
            ref={inputRef}
            type="file"
            name="file"
            required
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="w-full text-sm text-grey file:mr-4 file:border file:border-rule file:bg-ink-raised file:px-4 file:py-2 file:font-ui file:text-xs file:uppercase file:tracking-[0.14em] file:text-grey hover:file:text-ivory"
          />

          <div className="mt-4">
            <Upload />
          </div>
        </form>
      </div>
    </div>
  );
}

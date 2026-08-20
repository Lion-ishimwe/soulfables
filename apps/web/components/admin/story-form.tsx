'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveStory, type StoryActionResult } from '@/app/actions/stories';
import { Field, TextArea, Select } from './ui';

type Option = { value: string; label: string };

export type StoryDraft = {
  id?: string;
  title?: string;
  slug?: string;
  subtitle?: string | null;
  excerpt?: string | null;
  bodyMdx?: string | null;
  authorId?: string | null;
  shelfId?: string | null;
  access?: 'free' | 'premium';
  status?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

const WORDS_PER_MINUTE = 220;

function SaveBar({ status }: { status: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 border-t border-rule bg-ink/95 px-1 py-4 backdrop-blur">
      <p className="text-xs text-grey-muted">
        {status === 'published'
          ? 'Saving will make this visible on the public site.'
          : 'Only the House can see this while it is not published.'}
      </p>
      <div className="flex gap-3">
        <Link
          href="/admin/stories"
          className="border border-rule px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save story'}
        </button>
      </div>
    </div>
  );
}

export function StoryForm({
  draft,
  authors,
  shelves,
}: {
  draft: StoryDraft;
  authors: Option[];
  shelves: Option[];
}) {
  const [state, formAction] = useActionState<StoryActionResult, FormData>(
    saveStory,
    {},
  );

  const [title, setTitle] = useState(draft.title ?? '');
  const [slug, setSlug] = useState(draft.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [body, setBody] = useState(draft.bodyMdx ?? '');
  const [status, setStatus] = useState(draft.status ?? 'draft');

  // Slug follows the title until someone edits it by hand, then it stops —
  // changing a published URL silently would cost the story its search
  // ranking.
  function onTitle(v: string) {
    setTitle(v);
    if (!slugTouched) {
      setSlug(
        v
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 120),
      );
    }
  }

  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
  const sections = (body.match(/^::\s*.+$/gm) ?? []).length;

  return (
    <form action={formAction}>
      {draft.id && <input type="hidden" name="id" value={draft.id} />}

      {state.error && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-x-10 lg:grid-cols-[1fr_18rem]">
        {/* The story itself */}
        <div className="min-w-0">
          <div className="mb-5">
            <label htmlFor="f-title" className="sf-eyebrow mb-2 block">
              Title <span className="text-gold">*</span>
            </label>
            <input
              id="f-title"
              name="title"
              required
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              className="w-full border border-rule bg-ink-raised px-3.5 py-3 font-display text-2xl text-ivory outline-none transition-colors focus:border-gold/50"
            />
          </div>

          <Field
            label="Logline"
            name="subtitle"
            defaultValue={draft.subtitle}
            hint="The single line under the title on every card."
          />

          <TextArea
            label="Pull quote"
            name="excerpt"
            rows={2}
            defaultValue={draft.excerpt}
            hint="Used on shelf pages and social cards."
          />

          <div className="mb-5">
            <label htmlFor="f-bodyMdx" className="sf-eyebrow mb-2 block">
              Story
            </label>
            <textarea
              id="f-bodyMdx"
              name="bodyMdx"
              rows={22}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'Write the story here.\n\nStart a new section with a line like:\n\n:: The House Waits'}
              className="w-full resize-y border border-rule bg-ink-raised px-4 py-3.5 font-reading text-base leading-relaxed text-grey outline-none transition-colors focus:border-gold/50"
            />
            <p className="mt-2 text-xs text-grey-muted">
              Markdown. A line beginning{' '}
              <code className="text-gold">::</code> starts a new section —
              bookmarks and audio cues anchor to those, so they survive later
              edits.
            </p>
          </div>
        </div>

        {/* Settings */}
        <aside className="min-w-0 lg:border-l lg:border-rule lg:pl-8">
          <div className="mb-6 border border-rule p-4">
            <p className="sf-eyebrow mb-3">Measured</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-grey-muted">Words</dt>
                <dd className="tabular-nums text-ivory">{words.toLocaleString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grey-muted">Reading time</dt>
                <dd className="tabular-nums text-ivory">{minutes} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-grey-muted">Sections</dt>
                <dd className="tabular-nums text-ivory">{sections}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-grey-muted">
              Calculated on save. Never typed by hand.
            </p>
          </div>

          {/* Controlled, so the save bar can warn before publishing. */}
          <div className="mb-5">
            <label htmlFor="f-status" className="sf-eyebrow mb-2 block">
              Status
            </label>
            <select
              id="f-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
            >
              <option value="draft" className="bg-ink">Draft</option>
              <option value="in_review" className="bg-ink">In review</option>
              <option value="published" className="bg-ink">Published</option>
              <option value="archived" className="bg-ink">Archived</option>
            </select>
          </div>

          <Select
            label="Access"
            name="access"
            defaultValue={draft.access ?? 'free'}
            options={[
              { value: 'free', label: 'Free to everyone' },
              { value: 'premium', label: 'Residents only' },
            ]}
            hint="Premium hides the body, never the listing — the blurb stays indexable."
          />

          <Select
            label="Author"
            name="authorId"
            defaultValue={draft.authorId ?? ''}
            options={[{ value: '', label: '— none —' }, ...authors]}
          />

          <Select
            label="Shelf"
            name="shelfId"
            defaultValue={draft.shelfId ?? ''}
            options={[{ value: '', label: '— none —' }, ...shelves]}
            hint="The primary shelf. Drives breadcrumbs and the canonical URL."
          />

          <div className="mb-5">
            <label htmlFor="f-slug" className="sf-eyebrow mb-2 block">
              Web address <span className="text-gold">*</span>
            </label>
            <div className="flex items-center border border-rule bg-ink-raised focus-within:border-gold/50">
              <span className="pl-3 font-mono text-xs text-grey-muted">/story/</span>
              <input
                id="f-slug"
                name="slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                className="w-full bg-transparent px-1 py-2.5 font-mono text-xs text-ivory outline-none"
              />
            </div>
            <p className="mt-1.5 text-xs text-grey-muted">
              {draft.id
                ? 'Changing this breaks existing links and loses search ranking.'
                : 'Follows the title until you edit it.'}
            </p>
          </div>

          <details className="mb-5 border-t border-rule pt-4">
            <summary className="cursor-pointer font-ui text-xs uppercase tracking-[0.14em] text-grey-muted hover:text-ivory">
              Search listing
            </summary>
            <div className="pt-4">
              <Field
                label="SEO title"
                name="seoTitle"
                defaultValue={draft.seoTitle}
                hint="Defaults to the story title."
              />
              <TextArea
                label="SEO description"
                name="seoDescription"
                rows={3}
                defaultValue={draft.seoDescription}
                hint="Defaults to the logline."
              />
            </div>
          </details>
        </aside>
      </div>

      <SaveBar status={status} />
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveAuthor, type EditorialResult } from '@/app/actions/editorial';
import { Field, TextArea } from './ui';

export type AuthorDraft = {
  slug?: string;
  name?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isPersona?: boolean;
  sortOrder?: number;
};

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : isNew ? 'Add author' : 'Save author'}
    </button>
  );
}

/**
 * The author editor.
 *
 * The persona switch is the field that matters. "The Librarian" is a
 * House voice rather than a person, and marking it as such is not a
 * label — it changes what the site publishes about them: a persona gets
 * no Person structured data, so search engines are not told a fictional
 * keeper of a fictional house is a real author.
 */
export function AuthorForm({ draft }: { draft: AuthorDraft }) {
  const [state, formAction] = useActionState<EditorialResult, FormData>(
    saveAuthor,
    {},
  );

  const isNew = !draft.slug;
  const [name, setName] = useState(draft.name ?? '');
  const [slug, setSlug] = useState(draft.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [isPersona, setIsPersona] = useState(Boolean(draft.isPersona));

  function onName(v: string) {
    setName(v);
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

  return (
    <form action={formAction}>
      {draft.slug && (
        <input type="hidden" name="originalSlug" value={draft.slug} />
      )}

      {state.error && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}

      <div className="grid gap-x-10 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="mb-5">
            <label htmlFor="au-name" className="sf-eyebrow mb-2 block">
              Name <span className="text-gold">*</span>
            </label>
            <input
              id="au-name"
              name="name"
              required
              value={name}
              onChange={(e) => onName(e.target.value)}
              className="w-full border border-rule bg-ink-raised px-3.5 py-3 font-display text-2xl text-ivory outline-none focus:border-gold/50"
            />
          </div>

          <TextArea
            label="Biography"
            name="bio"
            rows={5}
            defaultValue={draft.bio}
            hint="Shown on story pages and in the House. A few sentences is plenty."
          />

          <Field
            label="Portrait"
            name="avatarUrl"
            defaultValue={draft.avatarUrl}
            placeholder="https://…"
            hint="Optional. Leave empty and the name stands on its own."
          />
        </div>

        <aside className="min-w-0 lg:border-l lg:border-rule lg:pl-8">
          <div className="mb-6 border border-rule p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="isPersona"
                checked={isPersona}
                onChange={(e) => setIsPersona(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 flex-none accent-[#C89528]"
              />
              <span>
                <span className="block font-ui text-sm text-ivory">
                  A House voice
                </span>
                <span className="mt-1.5 block text-xs leading-normal text-grey-muted">
                  Not a real person — like The Librarian. Personas are left
                  out of the author structured data, so search engines are
                  not told they are people.
                </span>
              </span>
            </label>
          </div>

          <Field
            label="Order"
            name="sortOrder"
            type="number"
            defaultValue={draft.sortOrder ?? 0}
            hint="Lower comes first in lists."
          />

          <div className="mb-5">
            <label htmlFor="au-slug" className="sf-eyebrow mb-2 block">
              Web address <span className="text-gold">*</span>
            </label>
            <div className="flex items-center border border-rule bg-ink-raised focus-within:border-gold/50">
              <span className="pl-3 font-mono text-xs text-grey-muted">/author/</span>
              <input
                id="au-slug"
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
              {isNew ? 'Follows the name until you edit it.' : 'Changing this breaks existing links.'}
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 border-t border-rule bg-ink/95 px-1 py-4 backdrop-blur">
        <p className="text-xs text-grey-muted">
          Authors are attached to stories, not the other way round.
        </p>
        <div className="flex gap-3">
          <Link
            href="/admin/authors"
            className="border border-rule px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory"
          >
            Cancel
          </Link>
          <Save isNew={isNew} />
        </div>
      </div>
    </form>
  );
}

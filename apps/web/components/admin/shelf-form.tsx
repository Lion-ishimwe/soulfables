'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveShelf, type EditorialResult } from '@/app/actions/editorial';
import { Field, TextArea, Select } from './ui';

type ShelfOption = { slug: string; label: string; emoji: string };
type StoryOption = { slug: string; title: string };

export type ShelfDraft = {
  slug?: string;
  label?: string;
  title?: string;
  emoji?: string;
  tagline?: string;
  librarianNote?: string | null;
  entryStorySlug?: string | null;
  sortOrder?: number;
  status?: string;
  arrivesFrom?: string[];
  continuesTo?: string[];
};

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : isNew ? 'Create shelf' : 'Save shelf'}
    </button>
  );
}

/**
 * The shelf editor.
 *
 * Two things here are not ordinary CMS fields.
 *
 * The Librarian's note is navigational, not decorative — on the live
 * shelf it tells readers where people usually go next, so it sits beside
 * the journey graph rather than in a "content" tab away from it.
 *
 * The journey itself is the seed of the Intelligence layer: editorial
 * judgement today, recomputed from behaviour later. Editing it here is
 * how that judgement gets recorded, so the field explains what it does
 * rather than assuming whoever opens this page already knows.
 */
export function ShelfForm({
  draft,
  shelves,
  stories,
}: {
  draft: ShelfDraft;
  shelves: ShelfOption[];
  stories: StoryOption[];
}) {
  const [state, formAction] = useActionState<EditorialResult, FormData>(
    saveShelf,
    {},
  );

  const isNew = !draft.slug;
  const [label, setLabel] = useState(draft.label ?? '');
  const [slug, setSlug] = useState(draft.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));

  const [arrivesFrom, setArrivesFrom] = useState<string[]>(draft.arrivesFrom ?? []);
  const [continuesTo, setContinuesTo] = useState<string[]>(draft.continuesTo ?? []);

  function onLabel(v: string) {
    setLabel(v);
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

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  // A shelf cannot lead to itself.
  const others = shelves.filter((s) => s.slug !== slug);

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
          <div className="mb-5 grid grid-cols-[5rem_1fr] gap-4">
            <div>
              <label htmlFor="sh-emoji" className="sf-eyebrow mb-2 block">
                Mark
              </label>
              <input
                id="sh-emoji"
                name="emoji"
                defaultValue={draft.emoji ?? ''}
                maxLength={8}
                className="w-full border border-rule bg-ink-raised px-3 py-3 text-center text-2xl outline-none focus:border-gold/50"
              />
            </div>
            <div>
              <label htmlFor="sh-label" className="sf-eyebrow mb-2 block">
                Label <span className="text-gold">*</span>
              </label>
              <input
                id="sh-label"
                name="label"
                required
                value={label}
                onChange={(e) => onLabel(e.target.value)}
                className="w-full border border-rule bg-ink-raised px-3.5 py-3 font-display text-2xl text-ivory outline-none focus:border-gold/50"
              />
              <p className="mt-1.5 text-xs text-grey-muted">
                What readers see in the nav — “Sleepless”, not “Anxiety”.
              </p>
            </div>
          </div>

          <Field
            label="Title"
            name="title"
            required
            defaultValue={draft.title}
            hint="The heading on the shelf page — “Stories About Heartbreak”."
          />

          <Field
            label="Tagline"
            name="tagline"
            defaultValue={draft.tagline}
            hint="One line under the title. “Love, loss, and the slow art of letting go.”"
          />

          <TextArea
            label="A note from the Librarian"
            name="librarianNote"
            rows={4}
            defaultValue={draft.librarianNote}
            hint="Shown in the Librarian's voice. It is allowed — encouraged — to send readers to another shelf."
          />

          {/* The journey graph. */}
          <fieldset className="mb-5 border border-rule p-5">
            <legend className="sf-eyebrow px-2">The journey</legend>
            <p className="mb-5 max-w-prose text-xs leading-normal text-grey-muted">
              Where readers arrive from, and where they go next. Shown on the
              shelf page, and used to decide what the Librarian suggests.
              Editorial judgement for now — once there is enough reading data
              these are recomputed, and this page stops being the source.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              {[
                { title: 'Arrives from', name: 'arrivesFrom', list: arrivesFrom, set: setArrivesFrom },
                { title: 'Continues to', name: 'continuesTo', list: continuesTo, set: setContinuesTo },
              ].map((group) => (
                <div key={group.name}>
                  <p className="mb-3 font-ui text-xs font-semibold text-ivory">
                    {group.title}
                  </p>
                  <ul className="space-y-1.5">
                    {others.map((s) => {
                      const on = group.list.includes(s.slug);
                      return (
                        <li key={s.slug}>
                          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-grey">
                            <input
                              type="checkbox"
                              name={group.name}
                              value={s.slug}
                              checked={on}
                              onChange={() => toggle(group.list, group.set, s.slug)}
                              className="h-3.5 w-3.5 accent-[#C89528]"
                            />
                            <span aria-hidden="true">{s.emoji}</span>
                            <span className={on ? 'text-ivory' : ''}>{s.label}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="min-w-0 lg:border-l lg:border-rule lg:pl-8">
          <Select
            label="Status"
            name="status"
            defaultValue={draft.status ?? 'published'}
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft — hidden' },
            ]}
          />

          <Select
            label="Begin here"
            name="entryStorySlug"
            defaultValue={draft.entryStorySlug ?? ''}
            options={[
              { value: '', label: '— newest story —' },
              ...stories.map((s) => ({ value: s.slug, label: s.title })),
            ]}
            hint="The story offered first to someone new to this shelf."
          />

          <Field
            label="Order"
            name="sortOrder"
            type="number"
            defaultValue={draft.sortOrder ?? 0}
            hint="Lower comes first on the front door."
          />

          <div className="mb-5">
            <label htmlFor="sh-slug" className="sf-eyebrow mb-2 block">
              Web address <span className="text-gold">*</span>
            </label>
            <div className="flex items-center border border-rule bg-ink-raised focus-within:border-gold/50">
              <span className="pl-3 font-mono text-xs text-grey-muted">/shelf/</span>
              <input
                id="sh-slug"
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
            <p className="mt-1.5 text-xs leading-normal text-grey-muted">
              {isNew
                ? 'Follows the label until you edit it.'
                : 'Changing this breaks every link readers have shared, and loses the shelf its search ranking.'}
            </p>
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 border-t border-rule bg-ink/95 px-1 py-4 backdrop-blur">
        <p className="text-xs text-grey-muted">
          Shelves are how readers find their way in. Renaming one is safe;
          changing its address is not.
        </p>
        <div className="flex gap-3">
          <Link
            href="/admin/shelves"
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

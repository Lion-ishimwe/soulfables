'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveProduct, type ProductActionResult } from '@/app/actions/products';
import { Field, TextArea, Select } from './ui';
import { CoverField } from '@/components/admin/cover-field';

export type ProductDraft = {
  id?: string;
  coverImage?: string | null;
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string | null;
  kind?: string;
  eyebrow?: string | null;
  pullQuote?: string | null;
  ctaLabel?: string | null;
  status?: string;
  currency?: string;
  price?: number;
};

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save product'}
    </button>
  );
}

export function ProductForm({ draft }: { draft: ProductDraft }) {
  const [state, formAction] = useActionState<ProductActionResult, FormData>(
    saveProduct,
    {},
  );

  const [title, setTitle] = useState(draft.title ?? '');
  const [slug, setSlug] = useState(draft.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));

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
        <div className="min-w-0">
          <div className="mb-5">
            <label htmlFor="p-title" className="sf-eyebrow mb-2 block">
              Title <span className="text-gold">*</span>
            </label>
            <input
              id="p-title"
              name="title"
              required
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              className="w-full border border-rule bg-ink-raised px-3.5 py-3 font-display text-2xl text-ivory outline-none transition-colors focus:border-gold/50"
            />
          </div>

          <Field
            label="Subtitle"
            name="subtitle"
            defaultValue={draft.subtitle}
            hint="e.g. A Soulfables Original by Apophia Kamwine"
          />

          <Field
            label="Eyebrow"
            name="eyebrow"
            defaultValue={draft.eyebrow}
            hint="The small caps line above the title on the shop page."
          />

          <TextArea
            label="Pull quote"
            name="pullQuote"
            rows={2}
            defaultValue={draft.pullQuote}
            hint="The line that sells it. Shown large and italic."
          />

          <TextArea
            label="Description"
            name="description"
            rows={8}
            defaultValue={draft.description}
          />

          <Field
            label="Button label"
            name="ctaLabel"
            defaultValue={draft.ctaLabel ?? 'Buy'}
            hint="e.g. Come home to yourself"
          />
        </div>

        <aside className="min-w-0 lg:border-l lg:border-rule lg:pl-8">
          {/*
            Uploaded or pasted, the same field the stories use. Until now a
            product's cover could only be an address typed by hand, which
            is why every book in the shop wore the drawn placeholder.
          */}
          <div className="mb-6">
            <CoverField
              name="coverImage"
              defaultValue={draft.coverImage ?? ''}
              title={title || 'Untitled'}
              author=""
              shelf={draft.kind === 'journal' ? 'healing' : 'heartbreak'}
            />
          </div>

          <Select
            label="Status"
            name="status"
            defaultValue={draft.status ?? 'draft'}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'in_review', label: 'In review' },
              { value: 'published', label: 'Published — on sale' },
              { value: 'archived', label: 'Archived' },
            ]}
          />

          <Select
            label="Kind"
            name="kind"
            defaultValue={draft.kind ?? 'ebook'}
            options={[
              { value: 'ebook', label: 'Ebook' },
              { value: 'anthology', label: 'Anthology' },
              { value: 'journal', label: 'Journal' },
              { value: 'deck', label: 'Card deck' },
              { value: 'audio', label: 'Audio' },
              { value: 'bundle', label: 'Bundle' },
            ]}
            hint="A bundle grants everything inside it on purchase."
          />

          <div className="mb-5 grid grid-cols-[5rem_1fr] gap-3">
            <Field label="Currency" name="currency" defaultValue={draft.currency ?? 'USD'} required />
            <Field
              label="Price"
              name="price"
              type="number"
              defaultValue={draft.price ?? ''}
              required
              placeholder="7.99"
            />
          </div>
          <p className="-mt-2 mb-5 text-xs text-grey-muted">
            In normal units — 7.99, not 799. Stored to the cent.
          </p>

          <div className="mb-5">
            <label htmlFor="p-slug" className="sf-eyebrow mb-2 block">
              Web address <span className="text-gold">*</span>
            </label>
            <div className="flex items-center border border-rule bg-ink-raised focus-within:border-gold/50">
              <span className="pl-3 font-mono text-xs text-grey-muted">/shop/</span>
              <input
                id="p-slug"
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
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-4 border-t border-rule bg-ink/95 px-1 py-4 backdrop-blur">
        <p className="text-xs text-grey-muted">
          A published product with no files can be bought but not delivered.
        </p>
        <div className="flex gap-3">
          <Link
            href="/admin/products"
            className="border border-rule px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:text-ivory"
          >
            Cancel
          </Link>
          <Save />
        </div>
      </div>
    </form>
  );
}

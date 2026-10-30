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
  pageCount?: number | null;
  idealFor?: string | null;
  status?: string;
  currency?: string;
  price?: number;
  /** Ids of the products chosen for "You may also find meaning in". */
  relatedIds?: string[];
  /** For a collection: the ids of the products inside it. */
  contentIds?: string[];
};

/** Another product, for the pickers. */
export type ProductChoice = { id: string; title: string; kind: string; status: string };

const KIND_WORD: Record<string, string> = { ebook: 'ebook', anthology: 'anthology', journal: 'journal', deck: 'card deck', audio: 'audio', bundle: 'collection' };

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

export function ProductForm({ draft, products = [] }: { draft: ProductDraft; products?: ProductChoice[] }) {
  const [state, formAction] = useActionState<ProductActionResult, FormData>(
    saveProduct,
    {},
  );

  const [title, setTitle] = useState(draft.title ?? '');
  const [slug, setSlug] = useState(draft.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(draft.slug));
  const [kind, setKind] = useState(draft.kind ?? 'ebook');
  const [currency, setCurrency] = useState(draft.currency ?? 'USD');
  const [price, setPrice] = useState(draft.price != null ? String(draft.price) : '');
  const others = products.filter((p) => p.id !== draft.id);
  const money = price ? `${currency.toUpperCase() === 'USD' ? '$' : currency.toUpperCase() + ' '}${Number(price).toFixed(2)}` : '';

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
            label="Bookshop invitation"
            name="ctaLabel"
            defaultValue={draft.ctaLabel ?? ''}
            hint="The button on the card in the Bookshop, in your words: e.g. Come home to yourself. Left empty, it says Open the ebook."
          />
          <p className="-mt-2 mb-5 text-xs text-grey-muted">
            The purchase button on the product page is made for you: <span className="text-ivory">Buy {KIND_WORD[kind] ?? kind}{money ? ` — ${money}` : ''}</span>
          </p>

          <div className="mb-5 grid gap-x-6 sm:grid-cols-[8rem_1fr]">
            <Field
              label="Pages"
              name="pageCount"
              type="number"
              defaultValue={draft.pageCount ?? ''}
              hint="Optional. Shown when set."
            />
            <TextArea
              label="Ideal for"
              name="idealFor"
              rows={3}
              defaultValue={draft.idealFor}
              hint="Optional. Who would get the most from this: e.g. Anyone rebuilding after a betrayal, one quiet page at a time."
            />
          </div>

          {others.length > 0 && (
            <fieldset className="mb-5 border border-rule p-4">
              <legend className="sf-eyebrow px-1">You may also find meaning in</legend>
              <p className="mb-3 text-xs text-grey-muted">Tick the products to show near the bottom of this page. Untick all and the Bookshop chooses for you.</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {others.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-start gap-2 text-sm text-ivory">
                      <input type="checkbox" name="related" value={p.id} defaultChecked={draft.relatedIds?.includes(p.id)} className="mt-1 accent-[rgb(var(--c-gold))]" />
                      <span>
                        {p.title} <span className="text-grey-muted">· {KIND_WORD[p.kind] ?? p.kind}{p.status !== 'published' ? ' · not on sale' : ''}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {kind === 'bundle' && (
            <fieldset className="mb-5 border border-gold/40 p-4">
              <legend className="sf-eyebrow px-1">Inside this collection</legend>
              <p className="mb-3 text-xs text-grey-muted">Every ticked product is granted to the buyer the moment payment clears, and listed on the page.</p>
              {others.filter((p) => p.kind !== 'bundle').length === 0 ? (
                <p className="text-sm text-grey-muted">No other products yet.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {others.filter((p) => p.kind !== 'bundle').map((p) => (
                    <li key={p.id}>
                      <label className="flex items-start gap-2 text-sm text-ivory">
                        <input type="checkbox" name="contents" value={p.id} defaultChecked={draft.contentIds?.includes(p.id)} className="mt-1 accent-[rgb(var(--c-gold))]" />
                        <span>
                          {p.title} <span className="text-grey-muted">· {KIND_WORD[p.kind] ?? p.kind}{p.status !== 'published' ? ' · not on sale' : ''}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          )}
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

          <div className="mb-5">
            <label htmlFor="p-kind" className="sf-eyebrow mb-2 block">
              Kind
            </label>
            <select
              id="p-kind"
              name="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full border border-rule bg-ink-raised px-3 py-2.5 text-sm text-ivory outline-none focus:border-gold/50"
            >
              <option value="ebook">Ebook</option>
              <option value="anthology">Anthology</option>
              <option value="journal">Journal</option>
              <option value="deck">Card deck</option>
              <option value="audio">Audio</option>
              <option value="bundle">Collection (bundle)</option>
            </select>
            <p className="mt-2 text-xs text-grey-muted">A collection grants everything inside it on purchase. Visitors see the word Collection.</p>
          </div>

          <div className="mb-5 grid grid-cols-[5rem_1fr] gap-3">
            <div className="mb-5">
              <label htmlFor="p-currency" className="sf-eyebrow mb-2 block">Currency</label>
              <input id="p-currency" name="currency" required value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-rule bg-ink-raised px-3 py-2.5 text-sm text-ivory outline-none focus:border-gold/50" />
            </div>
            <div className="mb-5">
              <label htmlFor="p-price" className="sf-eyebrow mb-2 block">Price</label>
              <input id="p-price" name="price" type="number" step="0.01" required placeholder="7.99" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border border-rule bg-ink-raised px-3 py-2.5 text-sm text-ivory outline-none focus:border-gold/50" />
            </div>
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

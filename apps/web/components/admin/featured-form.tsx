'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveFeatured, type EditorialResult } from '@/app/actions/editorial';

type Option = { slug: string; title: string };

export type Catalogue = {
  story: Option[];
  shelf: Option[];
  product: Option[];
  letter: Option[];
};

const PLACEMENTS = [
  { value: 'home_hero', label: 'Front door — hero', where: 'The first thing on the home page' },
  { value: 'librarian_pick', label: 'Front door — the Librarian suggests', where: 'Beneath the shelves' },
  { value: 'shop_hero', label: 'Bookshop — hero', where: 'Top of the shop' },
  { value: 'shelf_spotlight', label: 'Shelf — spotlight', where: 'Highlighted on a shelf page' },
] as const;

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Place it'}
    </button>
  );
}

/**
 * Choose what the House puts in front of people.
 *
 * The entity list re-filters when the kind changes, so it is not possible
 * to feature a shelf in a slot expecting a product — the commonest way a
 * featured-content editor produces a broken front page.
 */
export function FeaturedForm({ catalogue }: { catalogue: Catalogue }) {
  const [state, formAction] = useActionState<EditorialResult, FormData>(
    saveFeatured,
    {},
  );

  const [entityType, setEntityType] = useState<keyof Catalogue>('story');
  const options = catalogue[entityType];

  return (
    <form action={formAction} className="border border-rule p-6">
      <p className="sf-eyebrow mb-5">Place something</p>

      {state.error && (
        <p
          role="alert"
          className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          aria-live="polite"
          className="mb-5 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="ft-placement" className="sf-eyebrow mb-2 block">
            Where
          </label>
          <select
            id="ft-placement"
            name="placement"
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          >
            {PLACEMENTS.map((p) => (
              <option key={p.value} value={p.value} className="bg-ink">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ft-kind" className="sf-eyebrow mb-2 block">
            Kind
          </label>
          <select
            id="ft-kind"
            name="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as keyof Catalogue)}
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          >
            <option value="story" className="bg-ink">Story</option>
            <option value="shelf" className="bg-ink">Shelf</option>
            <option value="product" className="bg-ink">Product</option>
            <option value="letter" className="bg-ink">Letter</option>
          </select>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="ft-entity" className="sf-eyebrow mb-2 block">
          What
        </label>
        {options.length === 0 ? (
          <p className="border border-rule px-3.5 py-2.5 text-sm text-grey-muted">
            Nothing of that kind published yet.
          </p>
        ) : (
          <select
            id="ft-entity"
            name="entitySlug"
            required
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          >
            {options.map((o) => (
              <option key={o.slug} value={o.slug} className="bg-ink">
                {o.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_6rem]">
        <div>
          <label htmlFor="ft-headline" className="sf-eyebrow mb-2 block">
            Headline
          </label>
          <input
            id="ft-headline"
            name="headline"
            placeholder="The Librarian chose this for you today"
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none placeholder:text-grey-faint focus:border-gold/50"
          />
          <p className="mt-1.5 text-xs text-grey-muted">
            Optional. Sits above whatever is featured.
          </p>
        </div>

        <div>
          <label htmlFor="ft-order" className="sf-eyebrow mb-2 block">
            Order
          </label>
          <input
            id="ft-order"
            name="sortOrder"
            type="number"
            defaultValue={0}
            className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none focus:border-gold/50"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Save />
        <label className="flex items-center gap-2.5 text-sm text-grey">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="h-3.5 w-3.5 accent-[#C89528]"
          />
          Live now
        </label>
      </div>
    </form>
  );
}

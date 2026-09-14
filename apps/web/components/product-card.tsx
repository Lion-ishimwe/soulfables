import Link from 'next/link';
import type { Route } from 'next';
import { Cover } from '@/components/cover-art';
import type { Product } from '@/lib/content';

/** "ebook" → "Ebook", "deck" → "Card deck". What a reader would call it. */
export function kindLabel(kind: string): string {
  return (
    { ebook: 'Ebook', anthology: 'Anthology', journal: 'Journal', deck: 'Card deck', audio: 'Audio', bundle: 'Bundle' }[
      kind
    ] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
  );
}

/**
 * A book, shown as a book.
 *
 * The cover keeps its own proportions and stands whole on a lit shelf,
 * never cropped to fill a box. The shelf edge under it and the small
 * lift on hover are the whole of the effect: a shop card should make
 * you want to pick the thing up, not admire the card. Used on the front
 * door, the shop and beneath every product, so the collection looks like
 * one collection wherever it appears.
 */
export function ProductCard({ product: p }: { product: Product }) {
  return (
    <Link
      href={`/shop/${p.slug}` as Route}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-rule bg-ink-raised transition-colors duration-base ease-house hover:border-gold/40"
    >
      <span className="relative flex items-end justify-center border-b border-rule bg-ink px-6 pt-8">
        <span
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 35%, rgb(var(--c-gold) / 0.16), transparent 70%)',
          }}
        />
        <span className="relative aspect-[2/3] w-32 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 transition-transform duration-slow ease-house group-hover:-translate-y-1.5 sm:w-36">
          <Cover
            src={p.coverImage ?? null}
            title={p.title}
            author={p.subtitle ?? ''}
            shelf={p.kind === 'journal' ? 'healing' : 'love'}
            sizes="9rem"
          />
        </span>
      </span>

      <span className="flex flex-1 flex-col p-5">
        <span className="sf-eyebrow">{kindLabel(p.kind)}</span>
        <span className="mt-2 font-display text-xl leading-snug text-ivory transition-colors duration-base group-hover:text-gold">
          {p.title}
        </span>
        <span className="mt-1.5 line-clamp-2 flex-1 font-ui text-xs leading-relaxed text-grey-muted">
          {p.subtitle}
        </span>
        <span className="mt-4 flex items-baseline justify-between gap-3">
          <span className="font-display text-xl text-ivory">{p.priceLabel}</span>
          {p.formats.length > 0 && (
            <span className="font-ui text-micro uppercase tracking-[0.14em] text-grey-faint">
              {p.formats.join(' · ')}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

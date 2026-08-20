import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts } from '@/lib/content';

export const metadata: Metadata = {
  title: 'The Bookshop',
  description:
    'Books, journals, reflections, and tools for every season of being human.',
  alternates: { canonical: '/shop' },
};

export const revalidate = 300;

export default async function ShopPage() {
  const products = await getProducts();
  const hero = products.find((p) => p.featured);
  const rest = products.filter((p) => !p.featured);

  return (
    <>
      <header className="mx-auto max-w-content px-5 pb-16 pt-24 text-center sm:px-8">
        <p className="sf-eyebrow">The Soulfables Collection</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          Books, journals, reflections, and tools for every season of being human.
        </h1>
        <p className="mx-auto mt-6 max-w-measure text-base leading-normal text-grey-muted">
          Every piece is designed to be returned to, not used once and forgotten.
          Begin where your heart is.
        </p>
      </header>

      {hero && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <article className="border border-rule p-8 text-center sm:p-16">
            <p className="sf-eyebrow text-gold">{hero.eyebrow}</p>
            <h2 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
              {hero.title}
            </h2>
            <p className="mt-4 font-ui text-sm text-grey-muted">{hero.subtitle}</p>
            <blockquote className="mx-auto mt-10 max-w-measure font-display text-2xl font-light italic leading-snug text-grey">
              “{hero.pullQuote}”
            </blockquote>

            <Link
              href={`/shop/${hero.slug}`}
              className="mt-12 inline-block border border-gold/50 px-10 py-4 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
            >
              {hero.ctaLabel}
            </Link>

            <p className="mt-6 font-ui text-sm text-grey-muted">
              {hero.priceLabel} · {hero.formats.join(' + ')} · Instant access
            </p>
          </article>
        </section>
      )}

      <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
        <div className="mb-10 text-center">
          <p className="sf-eyebrow">The Librarian’s picks</p>
          <p className="mx-auto mt-4 max-w-measure text-sm leading-normal text-grey-muted">
            If you are visiting for the first time, these are the shelves the
            Librarian quietly recommends.
          </p>
        </div>

        <ul className="grid gap-px bg-rule sm:grid-cols-2">
          {rest.map((product) => (
            <li key={product.slug}>
              <Link
                href={`/shop/${product.slug}`}
                className="group flex h-full flex-col bg-ink p-10 transition-colors duration-base ease-house hover:bg-ink-raised"
              >
                <p className="sf-eyebrow">{product.eyebrow}</p>
                <h3 className="mt-5 font-display text-3xl font-light text-ivory transition-colors duration-base group-hover:text-gold">
                  {product.title}
                </h3>
                <p className="mt-2 font-ui text-sm text-grey-muted">
                  {product.subtitle}
                </p>
                <p className="mt-6 flex-1 font-display text-lg italic leading-snug text-grey">
                  {product.pullQuote}
                </p>
                <div className="mt-8 flex items-baseline justify-between">
                  <span className="font-display text-2xl text-ivory">
                    {product.priceLabel}
                  </span>
                  <span className="sf-eyebrow text-gold/70 transition-colors duration-base group-hover:text-gold">
                    {product.ctaLabel}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

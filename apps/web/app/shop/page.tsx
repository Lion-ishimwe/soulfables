import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts } from '@/lib/content';
import { Cover } from '@/components/cover-art';

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
          <article className="grid items-center gap-10 border border-rule p-8 sm:p-14 lg:grid-cols-[18rem_1fr] lg:gap-14">
            <div className="mx-auto aspect-[2/3] w-56 overflow-hidden shadow-cover lg:w-full">
              <Cover
                src={hero.coverImage}
                title={hero.title}
                author={hero.subtitle}
                shelf="heartbreak"
                sizes="(min-width: 1024px) 18rem, 14rem"
              />
            </div>

            <div className="text-center lg:text-left">
            <p className="sf-eyebrow text-gold">{hero.eyebrow}</p>
            <h2 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
              {hero.title}
            </h2>
            <p className="mt-4 font-ui text-sm text-grey-muted">{hero.subtitle}</p>
            <blockquote className="mt-8 max-w-measure font-display text-2xl font-light italic leading-snug text-grey lg:mx-0">
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
            </div>
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
                className="group flex h-full flex-col bg-ink transition-colors duration-base ease-house hover:bg-ink-raised"
              >
                <div className="aspect-[2/3] w-full overflow-hidden bg-ink-raised">
                  <Cover
                    src={product.coverImage}
                    title={product.title}
                    author={product.subtitle}
                    shelf={product.kind === 'journal' ? 'healing' : 'love'}
                    className="transition-transform duration-slow ease-house group-hover:scale-[1.03]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-8">
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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

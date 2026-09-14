import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getProducts } from '@/lib/content';
import { getHouseSettings } from '@/lib/settings';
import { isPaymentsConfigured } from '@/lib/payments/provider';
import { Cover } from '@/components/cover-art';
import { ProductCard, kindLabel } from '@/components/product-card';
import { getFeaturedOne, getFeatured, applyOrder } from '@/lib/featured';

export const metadata: Metadata = {
  title: 'The Bookshop',
  description:
    'Books, journals, reflections, and tools for every season of being human.',
  alternates: { canonical: '/shop' },
};

export const revalidate = 300;

/*
 * The Bookshop.
 *
 * One featured book shown as a room — its own art spread behind it —
 * then the collection as books on a shelf, then the three plain promises
 * a reader wants before they pay anyone: it arrives at once, in every
 * format, and it is theirs. And the address to write to if it does not.
 *
 * Until a payment provider is connected the shop says so at the top,
 * once, quietly. Every product page says it again at the price. Nobody
 * should reach a button that takes money the House cannot honour.
 */
export default async function ShopPage() {
  const [allProducts, placed, ordered, house] = await Promise.all([
    getProducts(),
    getFeaturedOne('shop_hero'),
    getFeatured('shop_order'),
    getHouseSettings(),
  ]);

  const products = applyOrder(allProducts, ordered);
  const hero =
    (placed && products.find((p) => p.slug === placed.slug)) ??
    products.find((p) => p.featured) ??
    products[0];
  const rest = products.filter((p) => p.slug !== hero?.slug);
  const heroEyebrow = placed?.headline ?? hero?.eyebrow;
  const heroQuote = placed?.blurb ?? hero?.pullQuote;
  const open = isPaymentsConfigured();

  return (
    <>
      <header className="mx-auto max-w-content px-5 pb-12 pt-20 text-center sm:px-8">
        <p className="sf-eyebrow">The Bookshop</p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          Books to be returned to, not used once and forgotten.
        </h1>
        <p className="mx-auto mt-5 max-w-measure font-ui text-base leading-relaxed text-grey-muted">
          Ebooks, journals and collections from the House. Every one arrives in your
          library the moment it is yours, in every format it comes in.
        </p>

        {!open && (
          <p className="mx-auto mt-8 inline-flex max-w-xl items-start gap-3 rounded border border-gold/30 bg-gold-dim px-5 py-3.5 text-left font-ui text-sm leading-relaxed text-ivory">
            <span aria-hidden="true" className="mt-0.5 text-gold">✦</span>
            <span>
              The counter is not open yet. You can read about everything here, and{' '}
              <Link href={'/letter' as Route} className="text-gold transition-colors hover:text-gold-soft">
                the weekly letter
              </Link>{' '}
              will say the moment it is.
            </span>
          </p>
        )}
      </header>

      {hero && (
        <section className="relative isolate overflow-hidden border-y border-rule">
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            {hero.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.coverImage}
                alt=""
                decoding="async"
                className="h-full w-full scale-110 object-cover opacity-50 blur-3xl"
              />
            ) : (
              <div
                className="absolute left-1/2 top-0 h-[28rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
                style={{
                  background:
                    'radial-gradient(ellipse at center, rgb(var(--c-gold) / 0.16) 0%, rgb(var(--c-gold) / 0) 70%)',
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/40" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
          </div>

          <article className="mx-auto grid max-w-page items-center gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[16rem_1fr] lg:gap-14 lg:py-20">
            <Link
              href={`/shop/${hero.slug}` as Route}
              className="group mx-auto block aspect-[2/3] w-48 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 transition-transform duration-slow ease-house hover:-translate-y-1.5 lg:w-full"
            >
              <Cover
                src={hero.coverImage}
                title={hero.title}
                author={hero.subtitle}
                shelf="heartbreak"
                sizes="(min-width: 1024px) 16rem, 12rem"
                priority
              />
            </Link>

            <div className="text-center lg:text-left">
              <p className="font-ui text-micro uppercase tracking-[0.24em] text-gold">
                {heroEyebrow || kindLabel(hero.kind)}
              </p>
              <h2 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
                {hero.title}
              </h2>
              <p className="mt-3 font-ui text-sm text-grey-muted">{hero.subtitle}</p>
              {heroQuote && (
                <blockquote className="mx-auto mt-6 max-w-measure font-display text-2xl font-light italic leading-snug text-grey lg:mx-0">
                  “{heroQuote}”
                </blockquote>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
                <Link
                  href={`/shop/${hero.slug}` as Route}
                  className="rounded bg-gold px-7 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90"
                >
                  {open ? hero.ctaLabel : 'Read about it'}
                </Link>
                <span className="font-ui text-sm text-grey-muted">
                  {hero.priceLabel}
                  {hero.formats.length > 0 && <> · {hero.formats.join(' + ')}</>}
                </span>
              </div>
            </div>
          </article>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mx-auto max-w-page px-5 py-20 sm:px-8">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <p className="sf-eyebrow">The collection</p>
            <p className="font-ui text-xs text-grey-muted">
              {products.length} {products.length === 1 ? 'title' : 'titles'}
            </p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        What a reader wants to know before paying anyone, said plainly
        and once. No badges, no countdowns: the House's whole manner is
        that it does not shout.
      */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-page px-5 py-16 sm:px-8">
          <ul className="grid gap-8 sm:grid-cols-3">
            {[
              {
                title: 'It arrives at once',
                copy: 'The moment payment clears, the book is in your library, on this site, ready to open or download.',
              },
              {
                title: 'Every format included',
                copy: 'One price buys every format the book comes in — read it on a phone, a tablet, a reader or a screen.',
              },
              {
                title: 'Yours to keep',
                copy: 'No locks and no expiry. Download it again whenever you like, for as long as the House stands.',
              },
            ].map((point) => (
              <li key={point.title}>
                <p className="flex items-center gap-2 font-display text-xl text-ivory">
                  <span aria-hidden="true" className="text-sm text-gold">✦</span>
                  {point.title}
                </p>
                <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">{point.copy}</p>
              </li>
            ))}
          </ul>
          <p className="mt-12 text-center font-ui text-sm text-grey-muted">
            A question about an order, a download, or a book that has not arrived: write to{' '}
            <a
              href={`mailto:${house.supportEmailShop}`}
              className="text-gold transition-colors hover:text-gold-soft"
            >
              {house.supportEmailShop}
            </a>
            . Somebody reads it.
          </p>
        </div>
      </section>
    </>
  );
}

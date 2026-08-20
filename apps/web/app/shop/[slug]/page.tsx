import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/content';
import { isPaymentsConfigured } from '@/lib/payments/provider';
import { BuyForm } from '@/components/buy-form';

/*
 * A product page.
 *
 * The price shown here is read from the database, and the buy form posts
 * only a slug — the amount is computed server-side at checkout, so there
 * is no field a tampered client could use to name its own price.
 *
 * When no payment provider is configured the control routes to a holding
 * page instead of a dead button. That state should be temporary; if it
 * appears in production, PAYMENT_API_KEY and PAYMENT_WEBHOOK_SECRET are
 * missing from the environment.
 */

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getProducts()).find((p) => p.slug === slug);
  if (!product) return { title: 'Not found' };

  return {
    title: product.title,
    description: product.subtitle,
    alternates: { canonical: `/shop/${product.slug}` },
    openGraph: {
      type: 'website',
      title: `${product.title} · Soulfables`,
      description: product.pullQuote,
      url: `/shop/${product.slug}`,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();

  const others = products.filter((p) => p.slug !== slug).slice(0, 3);

  // Until a provider is configured the buy control routes to a holding
  // page rather than a dead button.
  const paymentsReady = isPaymentsConfigured();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: product.title,
    description: product.subtitle,
    publisher: { '@type': 'Organization', name: 'Soulfables' },
    bookFormat: 'https://schema.org/EBook',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto max-w-page px-5 pt-10 sm:px-8">
        <Link
          href="/shop"
          className="font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
        >
          ← The Bookshop
        </Link>
      </nav>

      <article className="mx-auto max-w-content px-5 pb-24 pt-12 text-center sm:px-8">
        <p className="sf-eyebrow text-gold">{product.eyebrow}</p>
        <h1 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
          {product.title}
        </h1>
        <p className="mt-4 font-ui text-sm text-grey-muted">{product.subtitle}</p>

        <blockquote className="mx-auto mt-10 max-w-measure font-display text-2xl font-light italic leading-snug text-grey">
          “{product.pullQuote}”
        </blockquote>

        <div className="mx-auto mt-12 max-w-measure border border-rule p-8">
          <p className="font-display text-4xl text-ivory">{product.priceLabel}</p>
          <p className="mt-3 font-ui text-sm text-grey-muted">
            {product.formats.join(' + ')} · Instant access · Yours to keep
          </p>

          {paymentsReady ? (
            <BuyForm slug={product.slug} ctaLabel={product.ctaLabel} />
          ) : (
            <Link
              href="/shop/checkout-unavailable"
              className="mt-8 inline-block w-full border border-gold/50 px-10 py-4 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
            >
              {product.ctaLabel}
            </Link>
          )}

          <p className="mt-6 text-xs leading-normal text-grey-muted">
            Every purchase appears in your library the moment payment clears,
            in every format the book ships in.
          </p>
        </div>
      </article>

      {others.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <p className="sf-eyebrow mb-8 text-center">Also in the collection</p>
          <ul className="grid gap-px bg-rule sm:grid-cols-3">
            {others.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/shop/${p.slug}`}
                  className="group flex h-full flex-col bg-ink p-8 transition-colors duration-base ease-house hover:bg-ink-raised"
                >
                  <h2 className="font-display text-2xl font-light text-ivory transition-colors duration-base group-hover:text-gold">
                    {p.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-normal text-grey-muted">
                    {p.subtitle}
                  </p>
                  <p className="mt-6 font-display text-xl text-ivory">
                    {p.priceLabel}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

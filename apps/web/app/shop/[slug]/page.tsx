import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts } from '@/lib/content';
import { getHouseSettings } from '@/lib/settings';
import { isPaymentsConfigured } from '@/lib/payments/provider';
import { BuyForm } from '@/components/buy-form';
import { Cover } from '@/components/cover-art';
import { ProductCard, kindLabel } from '@/components/product-card';
import Image from 'next/image';

/*
 * A product page.
 *
 * The price shown here is read from the database, and the buy form posts
 * only a slug — the amount is computed server-side at checkout, so there
 * is no field a tampered client could use to name its own price.
 *
 * When no payment provider is configured the price card says so where
 * the button would be, rather than offering a button that leads to an
 * apology. That state should be temporary; if it appears in production,
 * PAYMENT_API_KEY and PAYMENT_WEBHOOK_SECRET are missing from the
 * environment.
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
      ...(product.coverImage ? { images: [{ url: product.coverImage }] } : {}),
    },
  };
}

function formatBytes(bytes: number | null): string | null {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FORMAT_NOTE: Record<string, string> = {
  EPUB: 'for phones, tablets and e-readers',
  PDF: 'for any screen, laid out as designed',
  MOBI: 'for older Kindles',
  MP3: 'to listen',
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [products, house] = await Promise.all([getProducts(), getHouseSettings()]);
  const product = products.find((p) => p.slug === slug);
  if (!product) notFound();

  const others = products.filter((p) => p.slug !== slug).slice(0, 4);
  const open = isPaymentsConfigured();
  const paragraphs = (product.description ?? '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': product.kind === 'audio' ? 'AudioObject' : 'Book',
    name: product.title,
    description: product.subtitle,
    publisher: { '@type': 'Organization', name: 'Soulfables' },
    bookFormat: 'https://schema.org/EBook',
    ...(product.coverImage ? { image: product.coverImage } : {}),
    ...(product.price
      ? {
          offers: {
            '@type': 'Offer',
            price: (product.price.unitAmount / 100).toFixed(2),
            priceCurrency: product.price.currency,
            availability: open ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
            url: `/shop/${product.slug}`,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---- The book, as a room -------------------------------------- */}
      <section className="relative isolate overflow-hidden border-b border-rule">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          {product.coverImage ? (
            <Image
              src={product.coverImage}
              alt=""
              fill
              sizes="100vw"
              quality={30}
              className="scale-110 object-cover opacity-50 blur-3xl"
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

        <nav aria-label="Breadcrumb" className="mx-auto max-w-page px-5 pt-8 sm:px-8">
          <Link
            href={'/shop' as Route}
            className="font-ui text-sm text-grey-muted transition-colors duration-base ease-house hover:text-ivory"
          >
            ← The Bookshop
          </Link>
        </nav>

        <div className="mx-auto grid max-w-page items-center gap-10 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[16rem_1fr] lg:gap-14 lg:pb-20">
          <div className="mx-auto aspect-[2/3] w-48 overflow-hidden rounded-sm shadow-cover ring-1 ring-ivory/10 lg:w-full">
            <Cover
              src={product.coverImage}
              title={product.title}
              author={product.subtitle}
              shelf={product.kind === 'journal' ? 'healing' : 'heartbreak'}
              sizes="(min-width: 1024px) 16rem, 12rem"
              priority
            />
          </div>

          <div className="text-center lg:text-left">
            <p className="font-ui text-micro uppercase tracking-[0.24em] text-gold">
              {product.eyebrow || kindLabel(product.kind)}
            </p>
            <h1 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
              {product.title}
            </h1>
            <p className="mt-3 font-ui text-base text-grey-muted">{product.subtitle}</p>
            {product.pullQuote && (
              <blockquote className="mx-auto mt-6 max-w-measure font-display text-2xl font-light italic leading-snug text-grey lg:mx-0">
                “{product.pullQuote}”
              </blockquote>
            )}
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-ui text-xs text-grey-muted lg:justify-start">
              <span>{kindLabel(product.kind)}</span>
              {product.formats.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.formats.join(' + ')}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>Published by Soulfables</span>
            </p>
          </div>
        </div>
      </section>

      {/* ---- About it, what you get, and the price --------------------- */}
      <section className="mx-auto max-w-page px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_22rem] lg:gap-16">
          <div className="min-w-0">
            {paragraphs.length > 0 ? (
              <>
                <p className="sf-eyebrow">About this {kindLabel(product.kind).toLowerCase()}</p>
                <div className="mt-5 max-w-measure space-y-5 font-reading text-lg leading-relaxed text-grey">
                  {paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="sf-eyebrow">About this {kindLabel(product.kind).toLowerCase()}</p>
                <p className="mt-5 max-w-measure font-reading text-lg leading-relaxed text-grey">
                  {product.subtitle}
                </p>
              </>
            )}

            <div className="mt-12 border-t border-rule pt-10">
              <p className="sf-eyebrow">What you get</p>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {product.files.length > 0 ? (
                  product.files.map((f) => (
                    <li key={f.format} className="flex items-start gap-3">
                      <span className="mt-1 flex h-7 w-11 shrink-0 items-center justify-center rounded border border-gold/40 font-mono text-micro uppercase text-gold">
                        {f.format}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-ui text-sm text-ivory">
                          {f.format} file
                          {formatBytes(f.sizeBytes) && (
                            <span className="text-grey-muted"> · {formatBytes(f.sizeBytes)}</span>
                          )}
                        </span>
                        <span className="block font-ui text-xs text-grey-muted">
                          {FORMAT_NOTE[f.format] ?? 'ready to download'}
                        </span>
                      </span>
                    </li>
                  ))
                ) : (product.stories?.length ?? 0) > 0 ? (
                  <li className="flex items-start gap-3 sm:col-span-2">
                    <span aria-hidden="true" className="mt-1 flex h-7 w-11 shrink-0 items-center justify-center rounded border border-gold/40 font-mono text-micro text-gold">✦</span>
                    <span className="min-w-0">
                      <span className="block font-ui text-sm text-ivory">Read here, in the House</span>
                      <span className="block font-ui text-xs text-grey-muted">
                        The story opens in your library the moment payment clears — no file to manage, and it is read aloud where a narration exists.
                      </span>
                    </span>
                  </li>
                ) : (
                  <li className="font-ui text-sm text-grey-muted sm:col-span-2">
                    The files are being prepared. Every format the {kindLabel(product.kind).toLowerCase()} ships in is included in the price.
                  </li>
                )}
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-1 flex h-7 w-11 shrink-0 items-center justify-center rounded border border-rule font-mono text-micro text-gold">✦</span>
                  <span className="min-w-0">
                    <span className="block font-ui text-sm text-ivory">In your library at once</span>
                    <span className="block font-ui text-xs text-grey-muted">Open it here, or download it, the moment payment clears.</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span aria-hidden="true" className="mt-1 flex h-7 w-11 shrink-0 items-center justify-center rounded border border-rule font-mono text-micro text-gold">✦</span>
                  <span className="min-w-0">
                    <span className="block font-ui text-sm text-ivory">Yours to keep</span>
                    <span className="block font-ui text-xs text-grey-muted">No locks, no expiry. Download it again whenever you like.</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* The price, and the one honest button. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-rule bg-ink-raised p-7">
              <p className="sf-eyebrow">{kindLabel(product.kind)}</p>
              <p className="mt-3 font-display text-4xl text-ivory">{product.priceLabel}</p>
              <p className="mt-2 font-ui text-xs text-grey-muted">
                One price, every format
                {product.formats.length > 0 && <> — {product.formats.join(' + ')}</>}. Includes VAT.
              </p>
              <p className="mt-1.5 font-ui text-xs text-grey-muted">
                <Link href={'/digital-products' as Route} className="text-gold transition-colors hover:text-gold-soft">
                  How buying works →
                </Link>
              </p>

              {open ? (
                <BuyForm slug={product.slug} ctaLabel={product.ctaLabel} />
              ) : (
                <div className="mt-7 border-t border-rule pt-6">
                  <p className="font-ui text-sm text-ivory">Not on sale yet.</p>
                  <p className="mt-2 font-ui text-xs leading-relaxed text-grey-muted">
                    The counter is being set up with care — the last thing the House will
                    do is take money and fail to hand over the book.
                  </p>
                  <Link
                    href={'/letter' as Route}
                    className="mt-5 inline-block w-full rounded border border-gold/50 px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
                  >
                    Tell me when it opens
                  </Link>
                </div>
              )}

              <p className="mt-6 font-ui text-xs leading-relaxed text-grey-muted">
                Questions before you buy?{' '}
                <a href={`mailto:${house.supportEmailShop}`} className="text-gold transition-colors hover:text-gold-soft">
                  {house.supportEmailShop}
                </a>
              </p>
            </div>
          </aside>
        </div>
      </section>

      {others.length > 0 && (
        <section className="border-t border-rule">
          <div className="mx-auto max-w-page px-5 py-16 sm:px-8">
            <p className="sf-eyebrow mb-8">Also in the collection</p>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((p) => (
                <li key={p.slug}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}

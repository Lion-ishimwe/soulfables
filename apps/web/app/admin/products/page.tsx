import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/admin-data';
import { PageHeader, StatusPill, EmptyState, NotConnected } from '@/components/admin/ui';
import { formatMoney } from '@/lib/content';

export const metadata: Metadata = { title: 'Products' };
export const dynamic = 'force-dynamic';

/**
 * The catalogue.
 *
 * The "Files" column is the one to scan: a published product with no
 * files is a product someone can buy and receive nothing for. It is
 * called out in red rather than left as a quiet zero.
 */
export default async function ProductsPage() {
  if (!isConfigured()) {
    return (
      <>
        <PageHeader title="Products" />
        <NotConnected />
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      'id, title, slug, kind, status, product_prices(currency, unit_amount, is_default), product_files(id, is_active)',
    )
    .order('sort_order');

  const products = data ?? [];

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Everything the bookshop sells, and the files each one delivers."
        action={{ href: '/admin/products/new', label: 'New product' }}
      />

      {products.length === 0 ? (
        <EmptyState
          title="Nothing for sale yet."
          body="Create a product, set its price, then upload the EPUB and PDF. Customers receive every active file the moment payment clears."
          action={{ href: '/admin/products/new', label: 'Add the first' }}
        />
      ) : (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="sf-eyebrow px-5 py-3 text-left">Product</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Kind</th>
                <th className="sf-eyebrow px-5 py-3 text-left">Status</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Price</th>
                <th className="sf-eyebrow px-5 py-3 text-right">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {products.map((p: Record<string, unknown>) => {
                const prices = (p.product_prices as {
                  currency: string;
                  unit_amount: number;
                  is_default: boolean;
                }[]) ?? [];
                const price = prices.find((x) => x.is_default) ?? prices[0];

                const files = ((p.product_files as { is_active: boolean }[]) ?? []).filter(
                  (f) => f.is_active,
                );

                const sellable = p.status === 'published';
                const undeliverable = sellable && files.length === 0 && p.kind !== 'bundle';

                return (
                  <tr key={p.id as string} className="hover:bg-ink-raised">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/products/${p.id}`} className="block">
                        <span className="block text-ivory">{p.title as string}</span>
                        <span className="mt-0.5 block font-mono text-xs text-grey-muted">
                          /shop/{p.slug as string}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-grey-muted">{p.kind as string}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={p.status as string} />
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-ivory">
                      {price ? formatMoney(price.unit_amount, price.currency) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {undeliverable ? (
                        <span
                          className="whitespace-nowrap border border-state-danger/50 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-state-danger"
                          title="Published with nothing to deliver"
                        >
                          No files
                        </span>
                      ) : (
                        <span className="tabular-nums text-grey-muted">
                          {files.length}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

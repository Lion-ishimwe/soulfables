import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/admin-data';
import { PageHeader, NotConnected } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';
import { FileUpload, type ProductFileRow } from '@/components/admin/file-upload';
import { PreviewUpload, type ProductPreviewRow } from '@/components/admin/preview-upload';
import type { ProductChoice } from '@/components/admin/product-form';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [{ id }, { saved, deleted }] = await Promise.all([params, searchParams]);

  if (!isConfigured()) {
    return (
      <>
        <PageHeader title="Edit product" />
        <NotConnected />
      </>
    );
  }

  const supabase = await createClient();
  const [{ data }, { data: allProducts }, { data: previewRows }, { data: relatedRows }, { data: childRows }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, title, slug, subtitle, description, kind, eyebrow, pull_quote, cta_label, status, page_count, ideal_for, cover_image, product_prices(currency, unit_amount, is_default), product_files(id, format, original_name, file_size_bytes, version, checksum, created_at, is_active)',
      )
      .eq('id', id)
      .single(),
    supabase.from('products').select('id, title, kind, status').order('title'),
    supabase.from('product_previews').select('id, kind, title, public_url, file_size_bytes').eq('product_id', id).order('sort_order'),
    supabase.from('product_related').select('related_id').eq('product_id', id).order('sort_order'),
    supabase.from('product_bundle_items').select('child_id').eq('bundle_id', id).order('sort_order'),
  ]);

  if (!data) notFound();

  const products: ProductChoice[] = ((allProducts ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    kind: p.kind as string,
    status: p.status as string,
  }));
  const previews: ProductPreviewRow[] = ((previewRows ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    kind: p.kind as 'pdf' | 'image',
    title: (p.title as string) ?? null,
    publicUrl: p.public_url as string,
    sizeBytes: (p.file_size_bytes as number) ?? null,
  }));
  const relatedIds = ((relatedRows ?? []) as { related_id: string }[]).map((r) => r.related_id);
  const contentIds = ((childRows ?? []) as { child_id: string }[]).map((r) => r.child_id);

  const prices = (data.product_prices as { currency: string; unit_amount: number; is_default: boolean }[]) ?? [];
  const price = prices.find((p) => p.is_default) ?? prices[0];

  const files: ProductFileRow[] = ((data.product_files as Record<string, unknown>[]) ?? [])
    .filter((f) => f.is_active)
    .map((f) => ({
      id: f.id as string,
      format: (f.format as string).toUpperCase(),
      originalName: (f.original_name as string) ?? null,
      sizeBytes: (f.file_size_bytes as number) ?? null,
      version: (f.version as number) ?? 1,
      checksum: (f.checksum as string) ?? null,
      createdAt: f.created_at as string,
    }));

  return (
    <>
      <PageHeader
        title={data.title as string}
        subtitle={data.status === 'published' ? 'On sale now.' : 'Not on sale.'}
      />

      {saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Saved.
        </p>
      )}
      {deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          File removed.
        </p>
      )}

      {data.status === 'published' && (
        <p className="mb-6">
          <Link
            href={`/shop/${data.slug as string}`}
            className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
          >
            View on site ↗
          </Link>
        </p>
      )}

      <ProductForm
        draft={{
          id: data.id as string,
          title: data.title as string,
          slug: data.slug as string,
          subtitle: data.subtitle as string | null,
          description: data.description as string | null,
          kind: data.kind as string,
          eyebrow: data.eyebrow as string | null,
          pullQuote: data.pull_quote as string | null,
          ctaLabel: data.cta_label as string | null,
          pageCount: (data.page_count as number | null) ?? null,
          idealFor: (data.ideal_for as string | null) ?? null,
          coverImage: (data.cover_image as string | null) ?? null,
          status: data.status as string,
          currency: price?.currency ?? 'USD',
          price: price ? price.unit_amount / 100 : undefined,
          relatedIds,
          contentIds,
        }}
        products={products}
      />

      <div className="mt-14 border-t border-rule pt-10">
        <FileUpload productId={data.id as string} files={files} />
      </div>

      <div className="mt-14 border-t border-rule pt-10">
        <PreviewUpload productId={data.id as string} previews={previews} />
      </div>
    </>
  );
}

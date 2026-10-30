import type { Metadata } from 'next';
import { isConfigured } from '@/lib/admin-data';
import { PageHeader, NotConnected } from '@/components/admin/ui';
import { ProductForm, type ProductChoice } from '@/components/admin/product-form';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'New product' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  let products: ProductChoice[] = [];
  if (isConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.from('products').select('id, title, kind, status').order('title');
    products = ((data ?? []) as Record<string, unknown>[]).map((p) => ({ id: p.id as string, title: p.title as string, kind: p.kind as string, status: p.status as string }));
  }
  return (
    <>
      <PageHeader
        title="New product"
        subtitle="Save it first, then upload the files it delivers."
      />
      {!isConfigured() ? (
        <NotConnected />
      ) : (
        <ProductForm draft={{ kind: 'ebook', status: 'draft', currency: 'USD' }} products={products} />
      )}
    </>
  );
}

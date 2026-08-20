import type { Metadata } from 'next';
import { isConfigured } from '@/lib/admin-data';
import { PageHeader, NotConnected } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/product-form';

export const metadata: Metadata = { title: 'New product' };
export const dynamic = 'force-dynamic';

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        title="New product"
        subtitle="Save it first, then upload the files it delivers."
      />
      {!isConfigured() ? (
        <NotConnected />
      ) : (
        <ProductForm draft={{ kind: 'ebook', status: 'draft', currency: 'USD' }} />
      )}
    </>
  );
}

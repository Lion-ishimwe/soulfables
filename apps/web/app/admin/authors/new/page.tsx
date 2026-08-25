import type { Metadata } from 'next';
import { listAdminAuthors } from '@/lib/admin-data';
import { PageHeader } from '@/components/admin/ui';
import { AuthorForm } from '@/components/admin/author-form';

export const metadata: Metadata = { title: 'New author' };
export const dynamic = 'force-dynamic';

export default async function NewAuthorPage() {
  const authors = await listAdminAuthors();
  return (
    <>
      <PageHeader title="New author" subtitle="A person, or a voice of the House." />
      <AuthorForm draft={{ sortOrder: authors.length }} />
    </>
  );
}

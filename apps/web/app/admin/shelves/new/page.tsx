import type { Metadata } from 'next';
import { listAdminShelves } from '@/lib/admin-data';
import { getStories } from '@/lib/content';
import { PageHeader } from '@/components/admin/ui';
import { ShelfForm } from '@/components/admin/shelf-form';

export const metadata: Metadata = { title: 'New shelf' };
export const dynamic = 'force-dynamic';

export default async function NewShelfPage() {
  const [shelves, stories] = await Promise.all([listAdminShelves(), getStories()]);

  return (
    <>
      <PageHeader
        title="New shelf"
        subtitle="A place in the House, with its own voice and its own way out."
      />
      <ShelfForm
        draft={{ status: 'published', sortOrder: shelves.length }}
        shelves={shelves.map((s) => ({ slug: s.slug, label: s.label, emoji: s.emoji }))}
        stories={stories.map((s) => ({ slug: s.slug, title: s.title }))}
      />
    </>
  );
}

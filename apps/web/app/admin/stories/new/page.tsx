import type { Metadata } from 'next';
import { listAuthorOptions, listShelfOptions, isReadOnly } from '@/lib/admin-data';
import { PageHeader, ReadOnlyNotice } from '@/components/admin/ui';
import { StoryForm } from '@/components/admin/story-form';

export const metadata: Metadata = { title: 'New story' };
export const dynamic = 'force-dynamic';

export default async function NewStoryPage() {
  const [authors, shelves] = await Promise.all([
    listAuthorOptions(),
    listShelfOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="New story"
        subtitle="Saves as a draft unless you set it to published."
      />
      {isReadOnly() && <ReadOnlyNotice />}
      <StoryForm draft={{ access: 'free', status: 'draft' }} authors={authors} shelves={shelves} />
    </>
  );
}

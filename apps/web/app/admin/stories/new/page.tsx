import type { Metadata } from 'next';
import { listAdminAuthors, listAdminShelves, listThemes } from '@/lib/admin-data';
import { listAdminSeries } from '@/lib/series';
import { PageHeader } from '@/components/admin/ui';
import { StoryForm } from '@/components/admin/story-form';
import { TemplatePanel } from '@/components/studio/template-panel';

export const metadata: Metadata = { title: 'New story' };
export const dynamic = 'force-dynamic';

export default async function NewStoryPage() {
  const [authors, shelves, themes] = await Promise.all([
    listAdminAuthors(),
    listAdminShelves(),
    listThemes(),
  ]);

  return (
    <>
      <PageHeader
        title="New story"
        subtitle="Write it here, or bring in a finished template."
      />

      <div className="mb-12">
        <TemplatePanel />
      </div>

      <div className="border-t border-rule pt-10">
        <h2 className="sf-eyebrow mb-6">Or write it here</h2>
        <StoryForm
          draft={{ access: 'free', status: 'draft', releaseMode: 'full' }}
          authors={authors.map((a) => ({ value: a.slug, label: a.name }))}
          shelves={shelves.map((s) => ({ value: s.slug, label: s.label }))}
          themes={themes.map((t) => ({ value: t.id, label: t.label }))}
          series={(await listAdminSeries()).map((x) => ({ value: x.slug, label: x.title }))}
        />
      </div>
    </>
  );
}

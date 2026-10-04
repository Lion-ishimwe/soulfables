import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { emailConfigured } from '@/lib/email';
import { listStoryChoices } from '@/lib/letters';
import { letterSubscriberCount } from '@/lib/admin-data';
import { PageHeader } from '@/components/admin/ui';
import { LetterEditor } from '@/components/admin/letter-editor';

export const metadata: Metadata = { title: 'A new letter' };
export const dynamic = 'force-dynamic';

export default async function NewLetterPage() {
  await requireStaff();
  const [stories, subscribers] = await Promise.all([listStoryChoices(), letterSubscriberCount()]);
  return (
    <>
      <PageHeader title="A new letter" subtitle="Write it, save it, read it in your inbox, then send it on Sunday." />
      <LetterEditor letter={null} stories={stories} subscribers={subscribers} emailReady={emailConfigured()} />
    </>
  );
}

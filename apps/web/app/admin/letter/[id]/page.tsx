import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { emailConfigured } from '@/lib/email';
import { getLetterForEditing, listStoryChoices } from '@/lib/letters';
import { letterSubscriberCount } from '@/lib/admin-data';
import { PageHeader } from '@/components/admin/ui';
import { LetterEditor } from '@/components/admin/letter-editor';

export const metadata: Metadata = { title: 'Weekly Letter' };
export const dynamic = 'force-dynamic';

/** One letter, open for writing, testing and sending. */
export default async function EditLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireStaff();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const [letter, stories, subscribers] = await Promise.all([getLetterForEditing(id), listStoryChoices(), letterSubscriberCount()]);
  if (!letter) notFound();

  return (
    <>
      <PageHeader title={letter.title} subtitle={letter.status === 'published' ? 'Sent, and published on the site.' : 'A draft. Nobody has it yet.'} />
      <LetterEditor letter={letter} stories={stories} subscribers={subscribers} emailReady={emailConfigured()} saved={saved === '1'} />
    </>
  );
}

import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Foundation' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="The Foundation"
      body="What Soulfables is built on, and what it will not do."
    />
  );
}

import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'My Library' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="YOUR SHELF"
      title="My Library"
      body="Everything you own, everything you saved, and everything you are part-way through."
    />
  );
}

import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Shelves' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE LIBRARY OF FEELINGS"
      title="All Shelves"
      body="Every shelf in the House, arranged by the feeling that brings people to it."
    />
  );
}

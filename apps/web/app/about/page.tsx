import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'About' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="About the House"
      body="Soulfables is a quiet place for modern folktales about love, loss, healing, identity, hope, and becoming."
    />
  );
}

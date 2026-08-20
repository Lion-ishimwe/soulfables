import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'The Librarian' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="The Librarian"
      body="The keeper of the House. Chooses what you read before you know you need it."
    />
  );
}

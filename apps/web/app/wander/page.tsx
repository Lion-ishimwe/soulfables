import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Wander' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="NO DESTINATION"
      title="Wander"
      body="Let the Librarian choose. A story picked for the hour you are in, not the shelf you were browsing. This room is being built."
    />
  );
}

import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Reading Journal' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE READING ROOM"
      title="Your Reading Room"
      body="Every story leaves an echo. This is where you keep them. Sign in to open your journal."
    />
  );
}

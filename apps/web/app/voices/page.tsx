import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Reader Voices' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="UNSIGNED"
      title="Reader Voices"
      body="Lines left by readers who did not sign their names. Moderated, and published with care."
    />
  );
}

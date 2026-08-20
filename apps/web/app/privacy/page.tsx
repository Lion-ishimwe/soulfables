import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Privacy' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="Privacy"
      body="What we keep, what we never keep, and what you can take with you when you leave."
    />
  );
}

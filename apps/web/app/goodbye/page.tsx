import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Goodbye', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE DOOR"
      title="Your account is gone."
      body="Everything you wrote and kept went with it. The library stays open to you as a visitor, and the door is here if you ever want to come back in."
      cta={{ href: '/library', label: 'Browse the library' }}
    />
  );
}

import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'The Weekly Letter' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="VOL. 1"
      title="The Weekly Letter"
      body="A letter each week, from the shelves. Not a newsletter — a letter, written slowly."
    />
  );
}

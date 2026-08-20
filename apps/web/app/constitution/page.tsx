import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Constitution' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="The Constitution"
      body="The rules the House keeps, including the ones about your privacy."
    />
  );
}

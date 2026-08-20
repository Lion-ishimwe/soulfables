import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Terms' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="Terms"
      body="The plain agreement between you and the House."
    />
  );
}

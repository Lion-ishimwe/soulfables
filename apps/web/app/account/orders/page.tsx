import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Orders' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="YOUR SHELF"
      title="Orders"
      body="Every purchase, its receipt, and its files."
    />
  );
}

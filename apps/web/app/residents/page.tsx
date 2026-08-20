import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Residents' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="THE HOUSE"
      title="Residents"
      body="Those who live here rather than visit. What that means is still being decided, and it is being decided carefully."
    />
  );
}

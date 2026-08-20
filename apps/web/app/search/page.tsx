import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Search' };

export default function Page() {
  return (
    <QuietPage
      eyebrow="FIND YOUR WAY"
      title="Search the House"
      body="Search across every story, shelf and letter. Arriving in Phase 2."
    />
  );
}

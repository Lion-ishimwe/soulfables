import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Lost in the library' };

/* The House keeps its voice even when a page is missing. */
export default function NotFound() {
  return (
    <QuietPage
      eyebrow="LOST IN THE LIBRARY"
      title="This page has wandered off."
      body="The path you were following has gone quiet. But there are many more stories waiting to find you."
      cta={{ href: '/library', label: 'Browse the library' }}
    />
  );
}

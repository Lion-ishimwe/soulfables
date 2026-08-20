import type { Metadata } from 'next';
import { QuietPage } from '@/components/quiet-page';

export const metadata: Metadata = { title: 'Not yet open', robots: { index: false } };

/*
 * Holding page until D1 (payment provider) is answered. Better than a
 * dead button, and it disappears the moment checkout is wired up.
 */
export default function Page() {
  return (
    <QuietPage
      eyebrow="THE COUNTER"
      title="The shop is not open yet."
      body="Payment is being set up carefully — the last thing this House will do is take money and fail to hand over the book. Join the Weekly Letter and you will hear the moment it opens."
      cta={{ href: '/letter', label: 'Receive the Weekly Letter' }}
    />
  );
}

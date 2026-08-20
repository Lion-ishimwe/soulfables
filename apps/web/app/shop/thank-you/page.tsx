import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OrderStatus } from '@/components/order-status';

export const metadata: Metadata = {
  title: 'Confirming your order',
  robots: { index: false, follow: false },
};

/*
 * The page a buyer lands on after paying.
 *
 * It grants nothing and asserts nothing. Coming back from the payment
 * provider proves a browser was redirected, not that money moved — so
 * this page waits for the webhook and says so plainly while it waits.
 * That single restraint is what §22 of the brief was asking for.
 */
export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref) redirect('/shop');

  return (
    <section className="mx-auto max-w-content px-5 py-28 sm:px-8">
      <OrderStatus reference={ref} />
    </section>
  );
}

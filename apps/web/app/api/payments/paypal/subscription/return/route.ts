import { NextResponse, type NextRequest } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider, isPaymentsConfigured } from '@/lib/payments/provider';
import { syncSubscription } from '@/lib/payments/subscriptions';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where PayPal sends a reader back after they approve Premium.
 *
 * Nothing in the URL is trusted for anything but finding the
 * subscription: PayPal is asked for its status, and the row is written
 * from PayPal's answer. The webhook does the same for a reader who
 * approved and closed the tab.
 */
export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.redirect(publicUrl(request, '/signin', { next: '/membership' }));

  const id = request.nextUrl.searchParams.get('subscription_id');
  if (!id || !isPaymentsConfigured()) {
    return NextResponse.redirect(publicUrl(request, '/membership', { pending: '1' }));
  }

  try {
    const provider = await getPaymentProvider();
    if (!provider.getSubscription) throw new Error('This provider has no subscriptions.');
    const facts = await provider.getSubscription(id);

    // The reader returning must be the reader it was created for.
    if (facts.customId && facts.customId !== viewer.id) {
      return NextResponse.redirect(publicUrl(request, '/membership', { pending: '1' }));
    }

    const { userId } = await syncSubscription(createAdminClient(), { ...facts, customId: viewer.id });
    const welcome = userId && ['ACTIVE', 'APPROVED'].includes(facts.status.toUpperCase());
    return NextResponse.redirect(publicUrl(request, '/membership', welcome ? { welcome: '1' } : { pending: '1' }));
  } catch (e) {
    console.error('[paypal] subscription return failed', id, e instanceof Error ? e.message : e);
    return NextResponse.redirect(publicUrl(request, '/membership', { pending: '1' }));
  }
}

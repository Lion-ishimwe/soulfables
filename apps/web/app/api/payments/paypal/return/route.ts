import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPaymentProvider, isPaymentsConfigured } from '@/lib/payments/provider';
import { PayPalProvider } from '@/lib/payments/paypal';
import { settlePaid } from '@/lib/payments/fulfil';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Where PayPal sends the buyer back.
 *
 * With PayPal, approving is not paying: the money moves when the
 * merchant captures. So this route captures, server to server, and
 * settles the order on PayPal's answer — the browser brought a token
 * and a reference, and neither is trusted for anything but finding the
 * order. Then it sends the buyer to the thank-you page, which shows the
 * order as paid at once rather than waiting on a webhook that, without
 * HTTPS on this address, may never come.
 *
 * Every failure here is a redirect, never an error page: the buyer is
 * mid-purchase and deserves a sentence, not a stack trace. The thank-you
 * page reads the order's real state and says what it finds.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const ref = q.get('ref') ?? '';
  const token = q.get('token') ?? ''; // PayPal's order id, appended by PayPal

  const thankYou = (extra?: Record<string, string>) =>
    NextResponse.redirect(publicUrl(request, '/shop/thank-you', { ref, ...(extra ?? {}) }));

  if (!ref || !token || !isPaymentsConfigured()) {
    return NextResponse.redirect(publicUrl(request, '/shop'));
  }

  const provider = await getPaymentProvider();
  if (!(provider instanceof PayPalProvider)) {
    return NextResponse.redirect(publicUrl(request, '/shop'));
  }

  const db = createAdminClient();

  // The order this token belongs to, by our own record of the session,
  // and only if the reference the browser carried agrees with it.
  const { data: order } = await db
    .from('orders')
    .select('id, reference, status, provider_session_id')
    .eq('provider_session_id', token)
    .maybeSingle();

  if (!order || order.reference !== ref) {
    return NextResponse.redirect(publicUrl(request, '/shop'));
  }
  if (order.status === 'paid') return thankYou();

  try {
    const capture = await provider.captureOrder(token);

    if (capture.status !== 'COMPLETED') {
      // PENDING happens for some funding sources; the webhook will finish
      // it. The thank-you page keeps watching.
      return thankYou();
    }

    const result = await settlePaid(db, {
      providerSessionId: capture.paypalOrderId,
      orderReference: capture.orderReference ?? order.reference,
      providerPaymentId: capture.captureId,
      amount: capture.amount,
      currency: capture.currency,
    });

    if (result.outcome === 'amount_mismatch') {
      console.error('[paypal] amount mismatch on return', order.reference);
    }
    return thankYou();
  } catch (e) {
    console.error('[paypal] capture on return failed', order.reference, e instanceof Error ? e.message : e);
    await db
      .from('orders')
      .update({ status: 'failed', failure_reason: 'capture_failed' })
      .eq('id', order.id)
      .eq('status', 'pending');
    return thankYou();
  }
}

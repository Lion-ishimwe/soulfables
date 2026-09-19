import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPaymentProvider,
  isPaymentsConfigured,
  WebhookVerificationError,
} from '@/lib/payments/provider';
import { settlePaid, settleFailed, settleRefunded } from '@/lib/payments/fulfil';
import { syncSubscription } from '@/lib/payments/subscriptions';

/**
 * The payment webhook. This is the only thing in the system that may
 * grant access to a paid file.
 *
 * The order of operations matters and is not arbitrary:
 *
 *   1. Read the RAW body. Signature verification hashes the exact bytes —
 *      parsing to JSON first would break it.
 *   2. Verify the signature. An unverified payload never becomes an
 *      event object, so no later code can accidentally trust it.
 *   3. Record the event, keyed on the provider's own event id. The unique
 *      index makes a duplicate a no-op: a provider retry storm is
 *      harmless, and a replayed capture cannot double-grant.
 *   4. Only then act.
 *
 * Responses are chosen for how providers behave on each status: 400 on a
 * bad signature (do not retry — it will never verify), 200 on a duplicate
 * or an event we ignore (stop retrying), 500 on a genuine processing
 * failure (please retry, we want another attempt).
 */

// Node runtime: signature verification needs the raw body and Node crypto.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature =
    request.headers.get('stripe-signature') ??
    request.headers.get('paypal-transmission-sig') ??
    request.headers.get('paddle-signature') ??
    request.headers.get('verif-hash');

  // Refuse before touching the payload if this environment cannot verify
  // it. Returning 500 would tell the provider to retry against a
  // deployment that can never succeed; 503 says "not now" and is the
  // honest answer to a missing key.
  if (!isPaymentsConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[webhook] refused: payment or database credentials are not configured',
    );
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  let event;
  try {
    const provider = await getPaymentProvider();
    event = await provider.parseWebhook(rawBody, signature, request.headers);
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      console.error('[webhook] signature rejected:', e.message);
      // Deliberately terse. A verbose error here helps an attacker probe.
      return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
    }
    console.error('[webhook] parse failed', e);
    return NextResponse.json({ error: 'unprocessable' }, { status: 500 });
  }

  const db = createAdminClient();
  const providerName = process.env.PAYMENT_PROVIDER ?? 'stripe';

  // --- Idempotency gate -------------------------------------------------
  //
  // Subtle and important: "seen before" is not the same as "finished
  // before". An attempt that recorded the event and then failed midway
  // leaves a row with processed_at still null. If we treated every
  // unique-violation as a duplicate, the provider's retry — the very
  // thing that would have rescued the order — would be answered 200 and
  // dropped, and a paying customer would never receive their book.
  //
  // So: a row with processed_at set is a true duplicate and we stop.
  // A row without it is an unfinished attempt and we carry on.
  const { error: logError } = await db.from('webhook_events').insert({
    provider: providerName,
    provider_event_id: event.providerEventId,
    event_type: event.type === 'ignored' ? event.rawType : event.type,
    payload: JSON.parse(rawBody),
    signature_verified: true,
    attempts: 1,
  });

  if (logError) {
    if (logError.code !== '23505') {
      console.error('[webhook] could not record event', logError);
      return NextResponse.json({ error: 'log failed' }, { status: 500 });
    }

    const { data: existing } = await db
      .from('webhook_events')
      .select('processed_at, attempts, error')
      .eq('provider', providerName)
      .eq('provider_event_id', event.providerEventId)
      .single();

    if (existing?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Unfinished. Count the attempt and fall through to process it.
    const attempts = (existing?.attempts ?? 1) + 1;

    // Stop eventually rather than retrying forever on a poisoned event.
    if (attempts > 8) {
      console.error(
        '[webhook] giving up after',
        attempts,
        'attempts:',
        event.providerEventId,
        existing?.error,
      );
      await db
        .from('webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          error: `abandoned after ${attempts} attempts: ${existing?.error ?? 'unknown'}`,
        })
        .eq('provider', providerName)
        .eq('provider_event_id', event.providerEventId);

      return NextResponse.json({ received: true, abandoned: true });
    }

    await db
      .from('webhook_events')
      .update({ attempts })
      .eq('provider', providerName)
      .eq('provider_event_id', event.providerEventId);
  }

  const markProcessed = async (error?: string) => {
    await db
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), error: error ?? null })
      .eq('provider', providerName)
      .eq('provider_event_id', event.providerEventId);
  };

  try {
    switch (event.type) {
      case 'payment.succeeded': {
        // Settlement is shared with PayPal's return route; see
        // lib/payments/fulfil.ts. Only verified evidence reaches it.
        const result = await settlePaid(db, event);

        if (result.outcome === 'order_not_found') {
          console.error('[webhook] no order for event', event.providerEventId);
          await markProcessed('order_not_found');
          // 200: retrying will not conjure the order. Alert on this
          // instead — it means checkout and webhook disagree.
          return NextResponse.json({ received: true, warning: 'order not found' });
        }
        if (result.outcome === 'amount_mismatch') {
          await markProcessed('amount_mismatch');
          return NextResponse.json({ received: true, warning: 'amount mismatch' });
        }
        await markProcessed();
        return NextResponse.json(
          result.outcome === 'already_paid'
            ? { received: true, alreadyPaid: true }
            : { received: true, granted: result.granted },
        );
      }

      case 'payment.failed': {
        await settleFailed(db, event);
        await markProcessed();
        return NextResponse.json({ received: true });
      }

      case 'subscription.changed': {
        await syncSubscription(db, event.subscription);
        break;
      }
      case 'payment.refunded': {
        await settleRefunded(db, event);
        await markProcessed();
        return NextResponse.json({ received: true });
      }

      default: {
        await markProcessed();
        return NextResponse.json({ received: true, ignored: true });
      }
    }
  } catch (e) {
    console.error('[webhook] processing failed', e);
    await markProcessed(e instanceof Error ? e.message : 'unknown');
    // 500 so the provider retries. The idempotency gate above means a
    // retry re-enters safely.
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  }
}

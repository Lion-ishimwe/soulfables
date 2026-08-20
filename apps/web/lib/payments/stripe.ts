import 'server-only';
import Stripe from 'stripe';
import {
  WebhookVerificationError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
} from './provider';

/**
 * Stripe implementation of the payment provider contract.
 *
 * Nothing outside this file imports `stripe`. If the business entity
 * turns out to be somewhere Stripe does not serve, this is the only file
 * that gets replaced.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private client: Stripe;

  constructor() {
    const key = process.env.PAYMENT_API_KEY;
    if (!key) {
      throw new Error('PAYMENT_API_KEY is not set.');
    }
    this.client = new Stripe(key, {
      // Pinned deliberately, and pinned to the version this SDK was built
      // against. An unpinned version means Stripe can change payload
      // shapes under a running deployment; a mismatched one means the SDK
      // types describe a different API than the one being called.
      // Upgrading the SDK means revisiting this line.
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
      appInfo: { name: 'Soulfables', version: '0.1.0' },
    });
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const session = await this.client.checkout.sessions.create(
      {
        mode: 'payment',
        // Amounts come from req.items, which the caller read from
        // product_prices. Never from anything the browser sent.
        line_items: req.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: req.currency.toLowerCase(),
            unit_amount: item.unitAmount,
            product_data: {
              name: item.title,
              ...(item.description ? { description: item.description } : {}),
            },
          },
        })),
        customer_email: req.email,
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        // Carried back on the webhook so the handler can find the order
        // without trusting anything in the return URL.
        client_reference_id: req.reference,
        metadata: {
          order_id: req.orderId,
          order_reference: req.reference,
        },
        payment_intent_data: {
          metadata: {
            order_id: req.orderId,
            order_reference: req.reference,
          },
        },
      },
      {
        // Stripe deduplicates retries of this exact call. Combined with
        // the unique index on (provider, provider_session_id), a
        // double-submitted checkout cannot produce two live sessions.
        idempotencyKey: `checkout_${req.orderId}`,
      },
    );

    if (!session.url) {
      throw new Error('Stripe returned a session with no redirect URL.');
    }

    return {
      providerSessionId: session.id,
      redirectUrl: session.url,
    };
  }

  async parseWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<PaymentEvent> {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      throw new WebhookVerificationError('PAYMENT_WEBHOOK_SECRET is not set.');
    }
    if (!signature) {
      throw new WebhookVerificationError('Missing stripe-signature header.');
    }

    let event: Stripe.Event;
    try {
      // Throws on a bad signature or a timestamp outside the tolerance
      // window, which is what stops replay of a captured payload.
      event = this.client.webhooks.constructEvent(rawBody, signature, secret);
    } catch (e) {
      throw new WebhookVerificationError(
        e instanceof Error ? e.message : 'Signature verification failed.',
      );
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        // A session can complete while payment is still processing — for
        // delayed methods this fires before money moves. Only treat
        // 'paid' as paid.
        if (s.payment_status !== 'paid') {
          return { type: 'ignored', providerEventId: event.id, rawType: `${event.type}:unpaid` };
        }
        return {
          type: 'payment.succeeded',
          providerEventId: event.id,
          providerSessionId: s.id,
          providerPaymentId:
            typeof s.payment_intent === 'string'
              ? s.payment_intent
              : (s.payment_intent?.id ?? null),
          orderReference: s.client_reference_id ?? s.metadata?.order_reference ?? null,
          email: s.customer_details?.email ?? s.customer_email ?? null,
          amount: s.amount_total ?? 0,
          currency: (s.currency ?? 'usd').toUpperCase(),
        };
      }

      case 'checkout.session.async_payment_succeeded': {
        const s = event.data.object;
        return {
          type: 'payment.succeeded',
          providerEventId: event.id,
          providerSessionId: s.id,
          providerPaymentId:
            typeof s.payment_intent === 'string'
              ? s.payment_intent
              : (s.payment_intent?.id ?? null),
          orderReference: s.client_reference_id ?? s.metadata?.order_reference ?? null,
          email: s.customer_details?.email ?? null,
          amount: s.amount_total ?? 0,
          currency: (s.currency ?? 'usd').toUpperCase(),
        };
      }

      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const s = event.data.object;
        return {
          type: 'payment.failed',
          providerEventId: event.id,
          providerSessionId: s.id,
          orderReference: s.client_reference_id ?? s.metadata?.order_reference ?? null,
          reason: event.type,
        };
      }

      case 'charge.refunded': {
        const c = event.data.object;
        return {
          type: 'payment.refunded',
          providerEventId: event.id,
          providerPaymentId:
            typeof c.payment_intent === 'string'
              ? c.payment_intent
              : (c.payment_intent?.id ?? null),
          orderReference: c.metadata?.order_reference ?? null,
          amount: c.amount_refunded,
        };
      }

      default:
        return { type: 'ignored', providerEventId: event.id, rawType: event.type };
    }
  }
}

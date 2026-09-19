import 'server-only';
import type { SubscriptionFacts } from './subscriptions';
import {
  WebhookVerificationError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentProvider,
  type SubscriptionRequest,
} from './provider';

/**
 * PayPal, behind the payment contract.
 *
 * Orders API v2, called directly: a token, an order, a capture, and a
 * signature check are four requests, and PayPal's SDKs are large,
 * thinly typed and quick to go stale. Everything PayPal-specific is in
 * this file; nothing outside it knows a PayPal order from a Stripe
 * session.
 *
 * How PayPal differs from Stripe, and what this file does about it:
 *
 *   - Approval is not payment. The buyer approves at PayPal and comes
 *     back; money moves only when the merchant CAPTURES. So the buyer's
 *     return lands on our own route, which captures server-side and
 *     settles the order on PayPal's answer — and the webhook for
 *     "approved" captures too, for the buyer who approved and closed the
 *     tab. Capturing twice is harmless: PayPal says ORDER_ALREADY_CAPTURED
 *     and we read the capture that exists.
 *
 *   - Webhooks are verified by asking PayPal, not by a shared secret.
 *     The five transmission headers and the body go to PayPal's
 *     verification endpoint, and only SUCCESS becomes an event.
 *
 *   - Amounts are decimal strings, not minor units. Converted at the
 *     edge, both ways, with the zero-decimal currencies handled.
 *
 * Settings:
 *   PAYMENT_PROVIDER=paypal
 *   PAYMENT_CLIENT_ID       the app's client id (not secret)
 *   PAYMENT_API_KEY         the app's client secret
 *   PAYMENT_WEBHOOK_SECRET  the webhook's id, from the developer dashboard
 *   PAYMENT_ENV             sandbox (default) or live
 */

const ZERO_DECIMAL = new Set(['JPY', 'HUF', 'TWD']);

function toMajor(minor: number, currency: string): string {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? String(minor) : (minor / 100).toFixed(2);
}

function toMinor(value: string, currency: string): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(n) : Math.round(n * 100);
}

export function paypalEnvironment(): 'sandbox' | 'live' {
  return process.env.PAYMENT_ENV === 'live' ? 'live' : 'sandbox';
}

type Link = { rel: string; href: string; method?: string };

type Capture = {
  id: string;
  status: string;
  amount?: { currency_code: string; value: string };
  custom_id?: string;
  invoice_id?: string;
  supplementary_data?: { related_ids?: { order_id?: string } };
  links?: Link[];
};

type OrderResponse = {
  id: string;
  status: string;
  payer?: { email_address?: string };
  links?: Link[];
  purchase_units?: {
    custom_id?: string;
    invoice_id?: string;
    payments?: { captures?: Capture[] };
  }[];
};

export type CaptureResult = {
  paypalOrderId: string;
  status: string;
  captureId: string | null;
  orderReference: string | null;
  payerEmail: string | null;
  amount: number;
  currency: string;
};

class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issue: string | null,
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal';
  private readonly base: string;
  private readonly clientId: string;
  private readonly secret: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor() {
    const clientId = process.env.PAYMENT_CLIENT_ID;
    const secret = process.env.PAYMENT_API_KEY;
    if (!clientId || !secret) {
      throw new Error('PAYMENT_CLIENT_ID and PAYMENT_API_KEY must both be set for PayPal.');
    }
    this.clientId = clientId;
    this.secret = secret;
    this.base =
      paypalEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  // --- Plumbing --------------------------------------------------------

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const res = await fetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new PayPalError(`PayPal refused the credentials (${res.status}).`, res.status, null);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    requestId?: string,
  ): Promise<T> {
    const token = await this.accessToken();
    const res = await fetch(`${this.base}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // PayPal deduplicates retries carrying the same id, so a
        // double-submitted checkout cannot make two orders.
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }

    if (!res.ok) {
      const err = data as { message?: string; details?: { issue?: string }[] } | null;
      throw new PayPalError(
        err?.message ?? `PayPal answered ${res.status}.`,
        res.status,
        err?.details?.[0]?.issue ?? null,
      );
    }
    return data as T;
  }

  // --- Checkout ----------------------------------------------------------

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const currency = req.currency.toUpperCase();
    const origin = new URL(req.successUrl).origin;

    const order = await this.call<OrderResponse>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: 'default',
            // Both carried on every later payload, so the webhook can find
            // the order without trusting anything in a return URL.
            custom_id: req.reference,
            invoice_id: req.reference,
            description: req.items[0]?.title.slice(0, 127),
            amount: {
              currency_code: currency,
              value: toMajor(req.totalAmount, currency),
              breakdown: {
                item_total: { currency_code: currency, value: toMajor(req.totalAmount, currency) },
              },
            },
            items: req.items.map((item) => ({
              name: item.title.slice(0, 127),
              ...(item.description ? { description: item.description.slice(0, 127) } : {}),
              quantity: String(item.quantity),
              unit_amount: { currency_code: currency, value: toMajor(item.unitAmount, currency) },
              category: 'DIGITAL_GOODS',
            })),
          },
        ],
        payment_source: {
          paypal: {
            ...(req.email ? { email_address: req.email } : {}),
            experience_context: {
              brand_name: 'Soulfables',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
              landing_page: 'GUEST_CHECKOUT',
              // Our own route, which captures before showing the
              // thank-you page. The cancel address is the caller's.
              return_url: `${origin}/api/payments/paypal/return?ref=${encodeURIComponent(req.reference)}`,
              cancel_url: req.cancelUrl,
            },
          },
        },
      },
      `checkout_${req.orderId}`,
    );

    const approve = order.links?.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    if (!approve) {
      throw new Error('PayPal returned an order with no approval link.');
    }

    return { providerSessionId: order.id, redirectUrl: approve.href };
  }

  // --- Capture -----------------------------------------------------------

  /**
   * Capture an approved order, or read the capture that already exists.
   * Called from the buyer's return and from the "approved" webhook; the
   * second caller finds ORDER_ALREADY_CAPTURED and reads the order back.
   */
  async captureOrder(paypalOrderId: string): Promise<CaptureResult> {
    let order: OrderResponse;
    try {
      order = await this.call<OrderResponse>(
        'POST',
        `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
        {},
        `capture_${paypalOrderId}`,
      );
    } catch (e) {
      if (e instanceof PayPalError && e.issue === 'ORDER_ALREADY_CAPTURED') {
        order = await this.call<OrderResponse>('GET', `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
      } else {
        throw e;
      }
    }
    return this.readCapture(order);
  }

  private readCapture(order: OrderResponse): CaptureResult {
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.find((c) => c.status === 'COMPLETED') ?? unit?.payments?.captures?.[0] ?? null;
    const currency = (capture?.amount?.currency_code ?? 'USD').toUpperCase();
    return {
      paypalOrderId: order.id,
      status: capture?.status ?? order.status,
      captureId: capture?.id ?? null,
      orderReference: unit?.custom_id ?? unit?.invoice_id ?? capture?.custom_id ?? null,
      payerEmail: order.payer?.email_address ?? null,
      amount: capture?.amount ? toMinor(capture.amount.value, currency) : 0,
      currency,
    };
  }

  // --- Subscriptions -----------------------------------------------------

  /**
   * Premium. A subscription on a plan the House created at PayPal; the
   * reader approves it there and comes back through our return route.
   * custom_id carries the reader's user id so every later payload can
   * find them without trusting the return URL.
   */
  async createSubscription(req: SubscriptionRequest): Promise<{ subscriptionId: string; approvalUrl: string }> {
    const created = await this.call<{ id: string; status: string; links?: Link[] }>(
      'POST',
      '/v1/billing/subscriptions',
      {
        plan_id: req.planId,
        custom_id: req.customId,
        ...(req.email ? { subscriber: { email_address: req.email } } : {}),
        application_context: {
          brand_name: 'Soulfables',
          user_action: 'SUBSCRIBE_NOW',
          shipping_preference: 'NO_SHIPPING',
          return_url: req.returnUrl,
          cancel_url: req.cancelUrl,
        },
      },
      `sub_${req.customId}_${req.planId}_${Date.now()}`,
    );
    const approve = created.links?.find((l) => l.rel === 'approve');
    if (!approve) throw new Error('PayPal returned a subscription with no approval link.');
    return { subscriptionId: created.id, approvalUrl: approve.href };
  }

  async getSubscription(id: string): Promise<SubscriptionFacts> {
    const sub = await this.call<{
      id: string;
      status: string;
      plan_id?: string;
      custom_id?: string;
      subscriber?: { email_address?: string };
      billing_info?: { next_billing_time?: string };
    }>('GET', `/v1/billing/subscriptions/${encodeURIComponent(id)}`);
    return {
      providerSubscriptionId: sub.id,
      status: sub.status,
      customId: sub.custom_id ?? null,
      planId: sub.plan_id ?? null,
      nextBillingTime: sub.billing_info?.next_billing_time ?? null,
      email: sub.subscriber?.email_address ?? null,
    };
  }

  async cancelSubscription(id: string, reason: string): Promise<void> {
    await this.call<unknown>('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason: reason.slice(0, 127) });
  }

  // --- Webhooks ----------------------------------------------------------

  async parseWebhook(rawBody: string, signature: string | null, headers?: Headers): Promise<PaymentEvent> {
    const webhookId = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!webhookId) throw new WebhookVerificationError('PAYMENT_WEBHOOK_SECRET (the webhook id) is not set.');
    if (!headers) throw new WebhookVerificationError('PayPal verification needs the request headers.');

    const h = (name: string) => headers.get(name);
    const transmission = {
      auth_algo: h('paypal-auth-algo'),
      cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'),
      transmission_sig: signature ?? h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'),
    };
    if (Object.values(transmission).some((v) => !v)) {
      throw new WebhookVerificationError('Missing PayPal transmission headers.');
    }

    let payload: {
      id: string;
      event_type: string;
      resource?: Record<string, unknown>;
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError('Body is not JSON.');
    }

    /*
     * PayPal verifies its own signature. The cert URL in the headers is
     * not fetched by us — PayPal's endpoint does the cryptography — so a
     * forged cert_url pointing somewhere else gains nothing.
     */
    let verdict: { verification_status?: string };
    try {
      verdict = await this.call<{ verification_status?: string }>('POST', '/v1/notifications/verify-webhook-signature', {
        ...transmission,
        webhook_id: webhookId,
        webhook_event: payload,
      });
    } catch (e) {
      throw new WebhookVerificationError(e instanceof Error ? e.message : 'Verification call failed.');
    }
    if (verdict.verification_status !== 'SUCCESS') {
      throw new WebhookVerificationError('PayPal did not verify the signature.');
    }

    const resource = (payload.resource ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);

    switch (payload.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        // Approved is not paid. Capture now, for the buyer who approved
        // and never came back; the capture's own event settles the order.
        const orderId = str(resource.id);
        if (orderId) {
          try {
            await this.captureOrder(orderId);
          } catch (e) {
            console.error('[paypal] capture on approval failed', orderId, e instanceof Error ? e.message : e);
          }
        }
        return { type: 'ignored', providerEventId: payload.id, rawType: `${payload.event_type}:captured` };
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = resource as unknown as Capture;
        const currency = (capture.amount?.currency_code ?? 'USD').toUpperCase();
        return {
          type: 'payment.succeeded',
          providerEventId: payload.id,
          providerSessionId: capture.supplementary_data?.related_ids?.order_id ?? null,
          providerPaymentId: capture.id ?? null,
          orderReference: capture.custom_id ?? capture.invoice_id ?? null,
          email: null,
          amount: capture.amount ? toMinor(capture.amount.value, currency) : 0,
          currency,
        };
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const capture = resource as unknown as Capture;
        return {
          type: 'payment.failed',
          providerEventId: payload.id,
          providerSessionId: capture.supplementary_data?.related_ids?.order_id ?? null,
          orderReference: capture.custom_id ?? capture.invoice_id ?? null,
          reason: payload.event_type,
        };
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const subId = str(resource.id);
        if (!subId) return { type: 'ignored', providerEventId: payload.id, rawType: payload.event_type };
        const billing = resource.billing_info as { next_billing_time?: string } | undefined;
        const subscriber = resource.subscriber as { email_address?: string } | undefined;
        return {
          type: 'subscription.changed',
          providerEventId: payload.id,
          subscription: {
            providerSubscriptionId: subId,
            status: str(resource.status) ?? 'ACTIVE',
            customId: str(resource.custom_id),
            planId: str(resource.plan_id),
            nextBillingTime: billing?.next_billing_time ?? null,
            email: subscriber?.email_address ?? null,
          },
        };
      }
      case 'PAYMENT.SALE.COMPLETED': {
        // A renewal. The sale names its subscription; PayPal is asked for
        // the new period end rather than trusting arithmetic.
        const subId = str(resource.billing_agreement_id);
        if (!subId) return { type: 'ignored', providerEventId: payload.id, rawType: payload.event_type };
        try {
          const facts = await this.getSubscription(subId);
          return { type: 'subscription.changed', providerEventId: payload.id, subscription: facts };
        } catch (e) {
          console.error('[paypal] could not read subscription after sale', subId, e instanceof Error ? e.message : e);
          return { type: 'ignored', providerEventId: payload.id, rawType: `${payload.event_type}:unread` };
        }
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        // The refund points at its capture through an "up" link.
        const links = (resource.links as Link[] | undefined) ?? [];
        const up = links.find((l) => l.rel === 'up')?.href ?? '';
        const captureId = up.split('/').filter(Boolean).pop() ?? null;
        const amount = resource.amount as { value?: string; currency_code?: string } | undefined;
        const currency = (amount?.currency_code ?? 'USD').toUpperCase();
        return {
          type: 'payment.refunded',
          providerEventId: payload.id,
          providerPaymentId: captureId,
          orderReference: str(resource.custom_id) ?? str(resource.invoice_id),
          amount: amount?.value ? toMinor(amount.value, currency) : 0,
        };
      }

      default:
        return { type: 'ignored', providerEventId: payload.id, rawType: payload.event_type };
    }
  }
}

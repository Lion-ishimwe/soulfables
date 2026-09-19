import 'server-only';
import type { SubscriptionFacts } from './subscriptions';

/**
 * The payment provider interface.
 *
 * Everything else in the commerce path — order creation, entitlement
 * granting, downloads, My Library — is written against this and knows
 * nothing about Stripe or PayPal. Adding a provider means writing one
 * new file that satisfies this contract and registering it below.
 *
 * Two rules the interface encodes rather than merely documents:
 *
 *   1. `createCheckout` takes product ids, never amounts. The caller
 *      cannot pass a price, so a tampered client cannot buy a $45 bundle
 *      for $1 — the amount is always read from the database here.
 *
 *   2. `parseWebhook` returns a discriminated event or throws. A handler
 *      can never accidentally process an unverified payload, because an
 *      unverified payload never becomes an event object.
 */

export type CheckoutLine = {
  productId: string;
  quantity: number;
};

export type CheckoutRequest = {
  orderId: string;
  reference: string;
  lines: CheckoutLine[];
  currency: string;
  /** Minor units, computed server-side from product_prices. */
  totalAmount: number;
  email?: string;
  successUrl: string;
  cancelUrl: string;
  /** Per-line display data, resolved from the database by the caller. */
  items: {
    productId: string;
    title: string;
    description?: string;
    unitAmount: number;
    quantity: number;
  }[];
};

export type CheckoutSession = {
  providerSessionId: string;
  redirectUrl: string;
};

/** Normalised webhook events. Providers map their own vocabulary onto these. */
export type PaymentEvent =
  | {
      type: 'payment.succeeded';
      providerEventId: string;
      providerSessionId: string | null;
      providerPaymentId: string | null;
      orderReference: string | null;
      email: string | null;
      amount: number;
      currency: string;
    }
  | {
      type: 'payment.failed';
      providerEventId: string;
      providerSessionId: string | null;
      orderReference: string | null;
      reason: string | null;
    }
  | {
      type: 'payment.refunded';
      providerEventId: string;
      providerPaymentId: string | null;
      orderReference: string | null;
      amount: number;
    }
  | {
      type: 'subscription.changed';
      providerEventId: string;
      subscription: SubscriptionFacts;
    }
  | {
      type: 'ignored';
      providerEventId: string;
      rawType: string;
    };

export type SubscriptionRequest = {
  /** The provider's plan id (PayPal: P-…). */
  planId: string;
  /** The reader's user id, carried on every later payload. */
  customId: string;
  email?: string;
  returnUrl: string;
  cancelUrl: string;
};

export interface PaymentProvider {
  readonly name: string;

  /** Create a hosted checkout session and return where to send the buyer. */
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;

  /**
   * Verify the signature and normalise the payload.
   * MUST throw if the signature does not verify. Never return a partial
   * result for an unverified request. The headers are there for
   * providers whose verification needs more than one of them.
   */
  parseWebhook(rawBody: string, signature: string | null, headers?: Headers): Promise<PaymentEvent>;

  /** Subscriptions, for providers that have them. Premium needs all three. */
  createSubscription?(req: SubscriptionRequest): Promise<{ subscriptionId: string; approvalUrl: string }>;
  getSubscription?(id: string): Promise<SubscriptionFacts>;
  cancelSubscription?(id: string, reason: string): Promise<void>;
  /**
   * What the provider itself charges on a plan, so the House can refuse
   * to advertise one price and bill another. Null when the plan is not
   * found or is not for sale.
   */
  getPlanPrice?(planId: string): Promise<PlanPrice | null>;
}

export type PlanPrice = { amount: number; currency: string; interval: 'month' | 'year' | 'other' };

/** Thrown when a webhook cannot be trusted. Handler responds 400. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const name = process.env.PAYMENT_PROVIDER ?? 'stripe';

  switch (name) {
    case 'stripe': {
      const { StripeProvider } = await import('./stripe');
      return new StripeProvider();
    }
    case 'paypal': {
      const { PayPalProvider } = await import('./paypal');
      return new PayPalProvider();
    }
    default:
      throw new Error(
        `Unknown PAYMENT_PROVIDER "${name}". Implement it in lib/payments/ and register it here.`,
      );
  }
}

export function isPaymentsConfigured(): boolean {
  const name = process.env.PAYMENT_PROVIDER ?? 'stripe';
  const base = Boolean(process.env.PAYMENT_API_KEY && process.env.PAYMENT_WEBHOOK_SECRET);
  // PayPal signs requests with a client id as well as a secret.
  return name === 'paypal' ? base && Boolean(process.env.PAYMENT_CLIENT_ID) : base;
}

/** For the Settings page: which counter, and whether it is the practice one. */
export function paymentsDescription(): string {
  const name = process.env.PAYMENT_PROVIDER ?? 'stripe';
  if (name === 'paypal') {
    return `PayPal, ${process.env.PAYMENT_ENV === 'live' ? 'live' : 'sandbox'}`;
  }
  return name;
}

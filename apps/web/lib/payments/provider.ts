import 'server-only';

/**
 * The payment provider interface.
 *
 * Everything else in the commerce path — order creation, entitlement
 * granting, downloads, My Library — is written against this and knows
 * nothing about Stripe. Swapping to Paddle or Flutterwave means writing
 * one new file that satisfies this contract and changing PAYMENT_PROVIDER.
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
      type: 'ignored';
      providerEventId: string;
      rawType: string;
    };

export interface PaymentProvider {
  readonly name: string;

  /** Create a hosted checkout session and return where to send the buyer. */
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;

  /**
   * Verify the signature and normalise the payload.
   * MUST throw if the signature does not verify. Never return a partial
   * result for an unverified request.
   */
  parseWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent>;
}

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
    default:
      throw new Error(
        `Unknown PAYMENT_PROVIDER "${name}". Implement it in lib/payments/ and register it here.`,
      );
  }
}

export function isPaymentsConfigured(): boolean {
  return Boolean(process.env.PAYMENT_API_KEY && process.env.PAYMENT_WEBHOOK_SECRET);
}

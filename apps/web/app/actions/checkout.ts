'use server';

import type { Route } from 'next';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { createAdminClient } from '@/lib/supabase/admin';
import { getViewer } from '@/lib/auth';
import { getPaymentProvider, isPaymentsConfigured } from '@/lib/payments/provider';

/**
 * Begin checkout.
 *
 * The single most important property of this function: it never accepts
 * an amount. It accepts a product slug, reads the price from
 * `product_prices`, and computes the total itself. A client that posts a
 * price gets it ignored, because there is no field to put it in.
 *
 * The order is created here in `pending` state and stays that way. Only
 * the webhook may move it to `paid` — this function has no code path that
 * grants anything.
 */

const checkoutSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  // Agreement to immediate delivery and the loss of the withdrawal right.
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm you want the book delivered straight away.' }) }),
});

export type CheckoutResult = { error?: string };

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  return `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`;
}

export async function startCheckout(
  _prev: CheckoutResult,
  formData: FormData,
): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse({
    slug: field(formData, 'slug'),
    email: field(formData, 'email'),
    consent: checkbox(formData, 'consent'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That product could not be found.' };
  }

  if (!isPaymentsConfigured()) {
    return {
      error:
        'Checkout is not configured in this environment. No payment was attempted.',
    };
  }

  const viewer = await getViewer();
  const email = viewer?.email ?? parsed.data.email ?? '';

  if (!email) {
    return { error: 'We need an email address to send your book to.' };
  }

  // Service role: `orders` has no client insert policy by design. Nothing
  // a browser can do reaches this table directly.
  const db = createAdminClient();

  // --- Price the order, server-side -----------------------------------
  const { data: product, error: productError } = await db
    .from('products')
    .select('id, title, subtitle, slug, status, product_prices(currency, unit_amount, is_default, is_active)')
    .eq('slug', parsed.data.slug)
    .eq('status', 'published')
    .single();

  if (productError || !product) {
    return { error: 'That product could not be found.' };
  }

  const prices = (product.product_prices as {
    currency: string;
    unit_amount: number;
    is_default: boolean;
    is_active: boolean;
  }[]) ?? [];

  const price = prices.find((p) => p.is_default && p.is_active) ?? prices.find((p) => p.is_active);

  if (!price) {
    return { error: 'That product is not for sale at the moment.' };
  }

  // --- Already owned? --------------------------------------------------
  if (viewer) {
    const { data: owned } = await db.rpc('has_entitlement', {
      p_user: viewer.id,
      p_product: product.id,
    });
    if (owned) {
      redirect('/account/library?already=1' as Route);
    }
  }

  // --- Create the pending order ---------------------------------------
  const { data: order, error: orderError } = await db
    .from('orders')
    .insert({
      user_id: viewer?.id ?? null,
      email,
      status: 'pending',
      provider: process.env.PAYMENT_PROVIDER ?? 'stripe',
      currency: price.currency,
      subtotal_amount: price.unit_amount,
      total_amount: price.unit_amount,
      // The buyer's agreement to immediate delivery, kept with the order.
      metadata: { consent_immediate_delivery_at: new Date().toISOString() },
    })
    .select('id, reference')
    .single();

  if (orderError || !order) {
    console.error('[checkout] order insert failed', orderError);
    return { error: 'We could not start checkout. Nothing has been charged.' };
  }

  const { error: itemError } = await db.from('order_items').insert({
    order_id: order.id,
    product_id: product.id,
    // Snapshotted: a later retitle or price change must not rewrite an
    // issued receipt.
    title_snapshot: product.title,
    unit_amount: price.unit_amount,
    currency: price.currency,
    quantity: 1,
  });

  if (itemError) {
    console.error('[checkout] order_items insert failed', itemError);
    return { error: 'We could not start checkout. Nothing has been charged.' };
  }

  // --- Hand off to the provider ---------------------------------------
  const origin = await siteOrigin();
  let redirectUrl: string;

  try {
    const provider = await getPaymentProvider();
    const session = await provider.createCheckout({
      orderId: order.id,
      reference: order.reference,
      currency: price.currency,
      totalAmount: price.unit_amount,
      email,
      lines: [{ productId: product.id, quantity: 1 }],
      items: [
        {
          productId: product.id,
          title: product.title,
          description: product.subtitle ?? undefined,
          unitAmount: price.unit_amount,
          quantity: 1,
        },
      ],
      // The success page grants nothing — it polls until the webhook has
      // done its work. See app/shop/thank-you.
      successUrl: `${origin}/shop/thank-you?ref=${encodeURIComponent(order.reference)}`,
      cancelUrl: `${origin}/shop/${product.slug}?cancelled=1`,
    });

    await db
      .from('orders')
      .update({ provider_session_id: session.providerSessionId })
      .eq('id', order.id);

    redirectUrl = session.redirectUrl;
  } catch (e) {
    console.error('[checkout] provider session failed', e);
    await db
      .from('orders')
      .update({ status: 'failed', failure_reason: 'provider_session_failed' })
      .eq('id', order.id);

    return {
      error: 'The payment page could not be opened. Nothing has been charged.',
    };
  }

  // Provider-hosted checkout lives on another origin. typedRoutes only
  // knows about paths in this app, so an absolute external URL has to be
  // cast — the value comes from the payment SDK, never from user input.
  redirect(redirectUrl as Route);
}

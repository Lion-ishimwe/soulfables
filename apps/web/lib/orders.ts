import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';

/**
 * A reader's own orders, for the Orders page and its receipts.
 *
 * Read with the reader's session, so RLS scopes every row to them: a
 * receipt is reachable only by the person it was issued to, and a
 * reference typed into the address bar by anyone else finds nothing.
 * Guest orders are not here until claimed — that happens at sign-in,
 * by email — which is the honest answer to "where is my order" for a
 * buyer who has not yet made the account the receipt belongs to.
 */

export type OrderLine = { title: string; unitAmount: number; quantity: number; currency: string };

export type Order = {
  id: string;
  reference: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | string;
  provider: string;
  providerPaymentId: string | null;
  email: string;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  lines: OrderLine[];
};

const SELECT =
  'id, reference, status, provider, provider_payment_id, email, currency, subtotal_amount, discount_amount, tax_amount, total_amount, created_at, paid_at, refunded_at, order_items(title_snapshot, unit_amount, quantity, currency)';

function shape(r: Record<string, unknown>): Order {
  const items = (r.order_items as Record<string, unknown>[] | null) ?? [];
  return {
    id: r.id as string,
    reference: r.reference as string,
    status: r.status as string,
    provider: r.provider as string,
    providerPaymentId: (r.provider_payment_id as string) ?? null,
    email: r.email as string,
    currency: r.currency as string,
    subtotal: Number(r.subtotal_amount ?? 0),
    discount: Number(r.discount_amount ?? 0),
    tax: Number(r.tax_amount ?? 0),
    total: Number(r.total_amount ?? 0),
    createdAt: r.created_at as string,
    paidAt: (r.paid_at as string) ?? null,
    refundedAt: (r.refunded_at as string) ?? null,
    lines: items.map((i) => ({
      title: i.title_snapshot as string,
      unitAmount: Number(i.unit_amount ?? 0),
      quantity: Number(i.quantity ?? 1),
      currency: i.currency as string,
    })),
  };
}

export async function getMyOrders(): Promise<Order[]> {
  if (isDemoMode()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from('orders').select(SELECT).order('created_at', { ascending: false });
  if (error) {
    console.error('[orders] getMyOrders', error.message);
    return [];
  }
  return (data ?? []).map((r) => shape(r as Record<string, unknown>));
}

export async function getMyOrder(reference: string): Promise<Order | null> {
  if (isDemoMode()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select(SELECT).eq('reference', reference).maybeSingle();
  return data ? shape(data as Record<string, unknown>) : null;
}

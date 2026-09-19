'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { field } from '@/lib/form';
import { requireStaff, requireViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getHouseSettings } from '@/lib/settings';
import { getPaymentProvider, isPaymentsConfigured } from '@/lib/payments/provider';
import { refundWindow, REASON_LABELS, type RefundReason } from '@/lib/refunds';
import { sendRefundDecisionEmail, sendRefundRequestEmail } from '@/lib/email';
import { formatMoney } from '@/lib/format';

export type RefundResult = { error?: string; message?: string };

const askSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(['faulty', 'changed_mind', 'duplicate', 'other']),
  message: z.string().trim().max(2000),
});

/**
 * A reader asks for a refund from the receipt.
 *
 * The order must be theirs and paid. The insert policy says so as
 * well, but the reasons are checked here so the reader gets a sentence
 * back rather than a refusal: a change of mind after fourteen days, or
 * after a download, is not grounds; a fault after thirty days is not
 * either. The desk is told by email; the reader sees the request on
 * the receipt from then on.
 */
export async function requestRefund(_prev: RefundResult, formData: FormData): Promise<RefundResult> {
  const viewer = await requireViewer('/account/orders');
  if (isDemoMode()) return { error: 'The demo has nothing to refund.' };

  const parsed = askSchema.safeParse({
    orderId: field(formData, 'orderId'),
    reason: field(formData, 'reason'),
    message: field(formData, 'message') ?? '',
  });
  if (!parsed.success) return { error: 'Choose a reason, and keep the note under two thousand characters.' };
  const { orderId, reason, message } = parsed.data;
  if (reason === 'other' && message.length < 10) return { error: 'Say in a sentence what is wrong.' };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, reference, status, paid_at, created_at, email, total_amount, currency, order_items(title_snapshot)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status !== 'paid') return { error: 'That order cannot be refunded: it was not paid, or it was already.' };

  const win = await refundWindow({ id: order.id, paidAt: order.paid_at, createdAt: order.created_at });
  if (reason === 'changed_mind' && !win.changeOfMindOpen) {
    return {
      error:
        win.downloads > 0
          ? 'A file of this book has been downloaded, so a change of mind is no longer grounds for a refund. If something is wrong with it, choose that instead.'
          : 'A change of mind is honoured within fourteen days of purchase, and this order is older than that.',
    };
  }
  if (reason === 'faulty' && !win.faultyOpen) {
    return {
      error:
        'Something wrong with a book is put right within thirty days of purchase, and this order is older than that. Write to the shop and we will still look.',
    };
  }

  const { error } = await supabase.from('refund_requests').insert({ order_id: order.id, user_id: viewer.id, reason, message });
  if (error) {
    if (error.code === '23505') return { error: 'A request on this order is already waiting.' };
    return { error: error.message };
  }

  const house = await getHouseSettings();
  const items = ((order.order_items ?? []) as { title_snapshot: string }[]).map((i) => i.title_snapshot);
  await sendRefundRequestEmail({
    to: house.supportEmailShop,
    orderReference: order.reference,
    orderId: order.id,
    buyer: order.email,
    items,
    amountLabel: formatMoney(Number(order.total_amount ?? 0), order.currency),
    reason: REASON_LABELS[reason as RefundReason],
    message,
    daysSincePaid: win.daysSincePaid,
    downloads: win.downloads,
  });

  revalidatePath(`/account/orders/${order.reference}`);
  revalidatePath('/admin/refunds');
  return { message: 'Asked. The House reads every request within a few days; the answer appears here and in your email.' };
}

const decideSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(['refund', 'decline']),
  note: z.string().trim().max(1000),
});

/**
 * Staff decide.
 *
 * Refund: the money goes back through the provider first; only when
 * that succeeds is the order marked refunded and access revoked, the
 * same two steps the provider's own webhook takes, so the event that
 * follows finds nothing left to do. Decline: the note is what the
 * reader reads on the receipt, so it is written to them, not about
 * them. Both land in the audit log.
 */
export async function decideRefund(_prev: RefundResult, formData: FormData): Promise<RefundResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'The demo has no refund desk.' };

  const parsed = decideSchema.safeParse({
    requestId: field(formData, 'requestId'),
    decision: field(formData, 'decision'),
    note: field(formData, 'note') ?? '',
  });
  if (!parsed.success) return { error: 'The decision did not read.' };
  const { requestId, decision, note } = parsed.data;
  if (decision === 'decline' && note.length < 5) return { error: 'A refusal needs a sentence the reader can understand.' };

  const supabase = await createClient();
  const { data: req } = await supabase
    .from('refund_requests')
    .select('id, status, order_id, user_id, orders!inner(reference, email, status, provider, provider_payment_id, total_amount, currency)')
    .eq('id', requestId)
    .maybeSingle();
  if (!req) return { error: 'That request is gone.' };
  if (req.status !== 'open') return { error: 'That request was already decided.' };
  const order = req.orders as unknown as {
    reference: string;
    email: string;
    status: string;
    provider: string;
    provider_payment_id: string | null;
    total_amount: number;
    currency: string;
  };

  const db = createAdminClient();
  const now = new Date().toISOString();

  if (decision === 'refund') {
    if (order.status !== 'paid') return { error: 'The order is not paid, so there is nothing to send back.' };
    if (!order.provider_payment_id) return { error: 'The order has no payment id to refund against. Refund it at the provider by hand.' };
    if (!isPaymentsConfigured()) return { error: 'No payment provider is connected.' };
    const provider = await getPaymentProvider();
    if (provider.name !== order.provider || !provider.refundPayment) {
      return { error: `This order was paid through ${order.provider}; refund it there by hand.` };
    }
    try {
      await provider.refundPayment({
        paymentId: order.provider_payment_id,
        amount: Number(order.total_amount),
        currency: order.currency,
        note: note || 'Refund from Soulfables',
        requestId: `refund_${req.id}`,
      });
    } catch (e) {
      console.error('[refunds] provider refund failed', e);
      return {
        error: 'The provider would not refund just now. Nothing was changed; try again in a moment or refund at the provider by hand.',
      };
    }

    await db.from('orders').update({ status: 'refunded', refunded_at: now }).eq('id', req.order_id);
    await db.rpc('revoke_entitlements_for_order', { p_order_id: req.order_id, p_reason: 'refund' });
  }

  const { error } = await db
    .from('refund_requests')
    .update({
      status: decision === 'refund' ? 'refunded' : 'declined',
      decision_note: note || null,
      decided_by: viewer.id,
      decided_at: now,
    })
    .eq('id', req.id);
  if (error) return { error: error.message };

  await db.from('audit_log').insert({
    action: decision === 'refund' ? 'refund.granted' : 'refund.declined',
    entity_type: 'order',
    entity_id: req.order_id,
    actor_id: viewer.id,
    actor_email: viewer.email ?? null,
    after: { request_id: req.id, note: note || null, amount: order.total_amount, currency: order.currency },
  });

  await sendRefundDecisionEmail({
    to: order.email,
    orderReference: order.reference,
    orderId: req.order_id,
    refunded: decision === 'refund',
    amountLabel: formatMoney(Number(order.total_amount), order.currency),
    note,
  });

  revalidatePath('/admin/refunds');
  revalidatePath('/admin/orders');
  revalidatePath(`/account/orders/${order.reference}`);
  revalidatePath('/account/library');
  return {
    message:
      decision === 'refund'
        ? `Refunded ${formatMoney(Number(order.total_amount), order.currency)} to ${order.email}. Their access is closed.`
        : 'Declined. The reader has the note.',
  };
}

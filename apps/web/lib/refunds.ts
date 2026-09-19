import 'server-only';
import { createClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { isDemoMode } from './demo/mode';

/**
 * Refunds, as the digital products policy sets them out.
 *
 * Three grounds and their windows, counted from the day the order was
 * paid: something is wrong with the book, thirty days; a change of
 * mind, fourteen days and only if no file of it was downloaded; the
 * same book bought twice, whenever it is noticed. The reader asks from
 * the receipt; staff decide on /admin/refunds with the download log in
 * front of them. Nothing here refunds by itself.
 */

export const FAULTY_DAYS = 30;
export const CHANGE_OF_MIND_DAYS = 14;

export type RefundReason = 'faulty' | 'changed_mind' | 'duplicate' | 'other';

export const REASON_LABELS: Record<RefundReason, string> = {
  faulty: 'Something is wrong with it',
  changed_mind: 'I changed my mind',
  duplicate: 'I bought it twice',
  other: 'Something else',
};

export type RefundRequest = {
  id: string;
  orderId: string;
  userId: string;
  reason: RefundReason;
  message: string;
  status: 'open' | 'refunded' | 'declined';
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type RefundWindow = {
  /** Days since the order was paid. */
  daysSincePaid: number;
  /** Within thirty days: a fault can still be put right or refunded. */
  faultyOpen: boolean;
  /** Within fourteen days: a change of mind can still be honoured. */
  changeOfMindOpen: boolean;
  /** How many times a file of this order was downloaded, and when last. */
  downloads: number;
  lastDownloadAt: string | null;
};

function shape(r: Record<string, unknown>): RefundRequest {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    userId: r.user_id as string,
    reason: r.reason as RefundReason,
    message: (r.message as string) ?? '',
    status: r.status as RefundRequest['status'],
    decisionNote: (r.decision_note as string) ?? null,
    decidedAt: (r.decided_at as string) ?? null,
    createdAt: r.created_at as string,
  };
}

/** The latest request on an order, read with the reader's own session. */
export async function getMyRefundRequest(orderId: string): Promise<RefundRequest | null> {
  if (isDemoMode()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? shape(data as Record<string, unknown>) : null;
}

/**
 * Where an order stands against the policy's windows.
 *
 * The download count comes through the entitlements the order granted:
 * every download row names its entitlement, and every entitlement
 * names its order. Read with the caller's session, so a reader sees
 * their own and staff see anyone's.
 */
export async function refundWindow(order: { id: string; paidAt: string | null; createdAt: string }): Promise<RefundWindow> {
  const paid = new Date(order.paidAt ?? order.createdAt).getTime();
  const daysSincePaid = Math.floor((Date.now() - paid) / 86_400_000);
  let downloads = 0;
  let lastDownloadAt: string | null = null;

  if (!isDemoMode()) {
    const supabase = await createClient();
    const { data: ents } = await supabase.from('entitlements').select('id').eq('order_id', order.id);
    const ids = (ents ?? []).map((e) => e.id as string);
    if (ids.length) {
      const { data: rows, count } = await supabase
        .from('download_events')
        .select('created_at', { count: 'exact' })
        .in('entitlement_id', ids)
        .order('created_at', { ascending: false })
        .limit(1);
      downloads = count ?? 0;
      lastDownloadAt = (rows?.[0]?.created_at as string) ?? null;
    }
  }

  return {
    daysSincePaid,
    faultyOpen: daysSincePaid <= FAULTY_DAYS,
    changeOfMindOpen: daysSincePaid <= CHANGE_OF_MIND_DAYS && downloads === 0,
    downloads,
    lastDownloadAt,
  };
}

// ---------------------------------------------------------------------
// The desk: what staff see
// ---------------------------------------------------------------------

export type DeskRequest = RefundRequest & {
  order: {
    reference: string;
    email: string;
    currency: string;
    total: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
    providerPaymentId: string | null;
    items: string[];
  };
  window: RefundWindow;
};

/**
 * Open requests first, then the last decisions. Read with the staff
 * session: the policies let staff see every order, entitlement and
 * download, so nothing here needs the service role.
 */
export async function listRefundRequests(): Promise<{ open: DeskRequest[]; decided: DeskRequest[] }> {
  if (isDemoMode()) return { open: [], decided: [] };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('refund_requests')
    .select(
      '*, orders!inner(reference, email, currency, total_amount, status, paid_at, created_at, provider_payment_id, order_items(title_snapshot))',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[refunds] listRefundRequests', error.message);
    return { open: [], decided: [] };
  }

  const rows = await Promise.all(
    (data ?? []).map(async (r) => {
      const row = r as Record<string, unknown>;
      const o = row.orders as Record<string, unknown>;
      const base = shape(row);
      const order = {
        reference: o.reference as string,
        email: o.email as string,
        currency: (o.currency as string) ?? 'USD',
        total: Number(o.total_amount ?? 0),
        status: o.status as string,
        paidAt: (o.paid_at as string) ?? null,
        createdAt: o.created_at as string,
        providerPaymentId: (o.provider_payment_id as string) ?? null,
        items: ((o.order_items ?? []) as { title_snapshot: string }[]).map((i) => i.title_snapshot),
      };
      const window = await refundWindow({ id: base.orderId, paidAt: order.paidAt, createdAt: order.createdAt });
      return { ...base, order, window } satisfies DeskRequest;
    }),
  );

  return {
    open: rows.filter((r) => r.status === 'open'),
    decided: rows.filter((r) => r.status !== 'open').slice(0, 30),
  };
}

/** How many are waiting, for the admin navigation. */
export async function countOpenRefundRequests(): Promise<number> {
  if (isDemoMode()) return 0;
  try {
    const db = createAdminClient();
    const { count } = await db.from('refund_requests').select('id', { count: 'exact', head: true }).eq('status', 'open');
    return count ?? 0;
  } catch {
    return 0;
  }
}

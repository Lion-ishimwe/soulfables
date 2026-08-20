import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Order status, for the thank-you page to poll.
 *
 * Returns only what a buyer standing at the counter needs: has it cleared
 * yet. No amounts, no email, no product ids — an order reference is
 * semi-guessable (SF-2026-0001), so this endpoint must not become a way
 * to enumerate what other people bought.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;

  if (!/^SF-\d{4}-\d{4,}$/.test(reference)) {
    return NextResponse.json({ status: 'unknown' }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ status: 'unknown' });
  }

  const db = createAdminClient();
  const { data } = await db
    .from('orders')
    .select('status, user_id')
    .eq('reference', reference)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ status: 'unknown' }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: data.status,
      // Guest orders need an account before entitlements exist.
      needsAccount: data.status === 'paid' && !data.user_id,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

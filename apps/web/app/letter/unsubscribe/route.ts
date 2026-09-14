import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The line at the foot of every letter. One click, no questions. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const back = (state: string) => NextResponse.redirect(publicUrl(request, '/letter', { left: state }));
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return back('no');

  const db = createAdminClient();
  const { data } = await db.from('letter_subscribers').select('id').eq('unsubscribe_token', token).maybeSingle();
  if (!data) return back('no');

  await db
    .from('letter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('id', data.id);
  return back('yes');
}

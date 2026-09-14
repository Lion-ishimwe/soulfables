import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The link in the confirmation email: pending becomes confirmed, once. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const back = (state: string) => NextResponse.redirect(publicUrl(request, '/letter', { confirmed: state }));
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return back('no');

  const db = createAdminClient();
  const { data } = await db
    .from('letter_subscribers')
    .select('id, status, token_expires_at')
    .eq('confirm_token', token)
    .maybeSingle();

  if (!data) return back('no');
  if (data.token_expires_at && new Date(data.token_expires_at as string).getTime() < Date.now()) return back('expired');

  await db
    .from('letter_subscribers')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), confirm_token: null })
    .eq('id', data.id);
  return back('yes');
}

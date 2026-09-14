import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/public-url';

/**
 * Where every emailed auth link lands: confirmations, magic links, and
 * password resets.
 *
 * Two jobs beyond exchanging the code for a session:
 *
 *   1. Claim any guest orders placed with this email. Someone who bought
 *      before they had an account — including customers imported from
 *      Base44 — gets their entitlements the moment they first sign in.
 *   2. Send them somewhere sensible, but only ever to a path on this site.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // The visitor's own origin, not the server's: behind nginx the two differ.
  const origin = publicUrl(request, '/').origin;
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next');

  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/account/library';

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/signin?error=link_expired`);
  }

  // Reconcile prior purchases. Failure here must not block sign-in — the
  // reader is legitimately authenticated either way, and a missing
  // entitlement is recoverable; a locked-out customer is not.
  if (data.user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient();
      await admin.rpc('claim_orders_for_user', {
        p_user_id: data.user.id,
        p_email: data.user.email,
      });
    } catch (e) {
      console.error('[auth/callback] claim_orders_for_user failed', e);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

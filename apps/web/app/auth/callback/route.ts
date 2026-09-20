import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicUrl } from '@/lib/public-url';
import { sendWelcomeEmail } from '@/lib/email';

/**
 * Where every emailed auth link lands: confirmations, magic links, and
 * password resets.
 *
 * Three jobs beyond exchanging the code for a session:
 *
 *   1. Claim any guest orders placed with this email. Someone who bought
 *      before they had an account — including customers imported from
 *      Base44 — gets their entitlements the moment they first sign in.
 *   2. Welcome them, once: the first time a new account's link is used,
 *      a welcome email goes out. The auth service's own confirmation
 *      mail proves the address; this one opens the door.
 *   3. Send them somewhere sensible, but only ever to a path on this site.
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

  // The auth service says so itself when a link was already used or is
  // too old: it comes back here with error= instead of code=.
  if (searchParams.get('error') || !code) {
    return NextResponse.redirect(`${origin}/signin?error=link_expired`);
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

  // The welcome, for an account that was made in the last hour and has
  // not been welcomed. Never in the way of the sign-in itself.
  if (data.user.email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const createdAt = new Date(data.user.created_at).getTime();
      if (Date.now() - createdAt < 60 * 60 * 1000) {
        const admin = createAdminClient();
        const { count } = await admin
          .from('email_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', data.user.id)
          .eq('template', 'welcome');
        if (!count) await sendWelcomeEmail(data.user.email, data.user.id);
      }
    } catch (e) {
      console.error('[auth/callback] welcome email failed', e);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

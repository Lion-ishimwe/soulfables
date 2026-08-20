import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Issue a download.
 *
 * This is the last gate in front of every paid file, so it is written to
 * fail closed at every step. The order is: identify the reader, find the
 * file, re-check the entitlement against the database, mint a short-lived
 * signed URL, log the mint, redirect.
 *
 * Things this route deliberately does NOT do:
 *   - trust an order id, a session, a referrer, or any query parameter
 *     other than the file id it is asked about
 *   - stream the file itself (which would put a public URL of our own in
 *     front of private content)
 *   - tell an unauthorised caller whether the file exists
 *
 * The worst outcome of a bug here should be a customer who cannot
 * download, never a stranger who can.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Signed URLs live long enough to start a download, not to be shared. */
const SIGNED_URL_TTL_SECONDS = 120;

/** Crude abuse ceiling per reader per hour. */
const MAX_DOWNLOADS_PER_HOUR = 40;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Misconfiguration is not the same as a failed download, and must not
  // look like one. Without credentials this route cannot check an
  // entitlement, so it refuses rather than throwing — a 500 here reads as
  // a transient glitch and invites a retry that can never succeed.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error('[download] refused: Supabase credentials are not configured');
    return NextResponse.json(
      { error: 'Downloads are unavailable in this environment.' },
      { status: 503 },
    );
  }

  // --- Who is asking ----------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Send them to sign in rather than 401ing a browser navigation.
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.search = `?next=${encodeURIComponent(`/api/download/${fileId}`)}`;
    return NextResponse.redirect(url);
  }

  const db = createAdminClient();

  // --- Rate limit -------------------------------------------------------
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db
    .from('download_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since);

  if ((count ?? 0) >= MAX_DOWNLOADS_PER_HOUR) {
    return NextResponse.json(
      { error: 'Too many downloads in the last hour. Try again shortly.' },
      { status: 429 },
    );
  }

  // --- What are they asking for ----------------------------------------
  const { data: file } = await db
    .from('product_files')
    .select('id, product_id, storage_path, format, original_name, is_active')
    .eq('id', fileId)
    .maybeSingle();

  if (!file || !file.is_active) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // --- May they have it -------------------------------------------------
  // Asks the database, not the session. has_entitlement() checks for a
  // live, unrevoked, unexpired grant.
  const { data: entitled, error: checkError } = await db.rpc('has_entitlement', {
    p_user: user.id,
    p_product: file.product_id,
  });

  if (checkError) {
    console.error('[download] entitlement check failed', checkError);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  if (!entitled) {
    // 404, not 403: someone probing file ids learns nothing about which
    // ones are real.
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // --- Mint --------------------------------------------------------------
  const downloadName =
    file.original_name ?? `soulfables-${file.format}.${file.format}`;

  const { data: signed, error: signError } = await db.storage
    .from('private-files')
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: downloadName,
    });

  if (signError || !signed) {
    console.error('[download] could not sign', signError);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  // --- Log it ------------------------------------------------------------
  const { data: entitlement } = await db
    .from('entitlements')
    .select('id')
    .eq('user_id', user.id)
    .eq('product_id', file.product_id)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();

  await db.from('download_events').insert({
    user_id: user.id,
    entitlement_id: entitlement?.id ?? null,
    product_file_id: file.id,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    ip_address:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: request.headers.get('user-agent'),
  });

  // 302 rather than 307: this is a one-time redirect to a URL that will
  // stop working in two minutes, and must never be cached.
  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'no-store, private' },
  });
}

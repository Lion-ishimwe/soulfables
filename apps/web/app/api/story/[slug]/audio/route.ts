import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/demo/mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Long enough to listen to a story in one sitting; short enough that a shared link goes stale. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 2;

/**
 * The narration route: the address the player asks for.
 *
 * Narration lives in a private bucket that no policy lets a browser
 * read. This route asks the database whether the caller may hear this
 * story's narration — the same resident-or-staff rule the prose uses —
 * and, if so, signs a short-lived URL with the service role and sends
 * the browser there. The storage key itself never reaches the page.
 *
 * A redirect rather than a proxy: the browser then talks to storage
 * directly, with range requests, so scrubbing and resuming work and the
 * instance does not stream audio through itself.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The app asks for the address as JSON; a browser follows the redirect.
  const wantsJson = new URL(request.url).searchParams.get('json') === '1';

  if (isDemoMode() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('narration_for_reader', { p_slug: slug });
  if (error) {
    console.error('[audio] narration_for_reader', error.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { storage_path: string; format: string; locked: boolean; count_listen: boolean; story_id: string }
    | undefined;

  // 404 for both "no narration" and "not for you": the difference is
  // nobody's business but the reader's, and the page already told them.
  if (!row || row.locked) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const admin = createAdminClient();

  /*
   * A Free reader's allowance is counted here, at the moment the file is
   * handed over: one row per reader, story and month, so the same story
   * twice costs one. Premium and staff are never counted.
   */
  if (row.count_listen) {
    const { data: who } = await supabase.auth.getUser();
    if (who.user) {
      const month = new Date();
      const first = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}-01`;
      await admin
        .from('narration_listens')
        .upsert({ user_id: who.user.id, story_id: row.story_id, month: first }, { onConflict: 'user_id,story_id,month', ignoreDuplicates: true });
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from('protected-media')
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    console.error('[audio] could not sign', slug, signError?.message);
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  if (wantsJson) {
    return NextResponse.json(
      { url: signed.signedUrl, format: row.format, expiresIn: SIGNED_URL_TTL_SECONDS },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  return NextResponse.redirect(signed.signedUrl, {
    status: 302,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

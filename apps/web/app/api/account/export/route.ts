import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/demo/mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything the House holds about you, as one file.
 *
 * Read with the reader's own session, so RLS decides what "yours" means
 * — the same policies that draw every page. Journal entries included:
 * they are private from the House, not from their author. Plain JSON,
 * because it is the format most likely to still open in ten years and
 * the one another service can take.
 */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'sign-in-required' }, { status: 401 });
  if (isDemoMode()) return NextResponse.json({ error: 'The demo keeps nothing to export.' }, { status: 503 });

  const supabase = await createClient();
  const table = async (name: string, select: string, order?: string) => {
    let q = supabase.from(name).select(select);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) console.error('[export]', name, error.message);
    return data ?? [];
  };

  const [profile, orders, entitlements, reading, saved, bookmarks, passages, journal, settings] = await Promise.all([
    supabase.from('profiles').select('display_name, bio, created_at').eq('id', viewer.id).maybeSingle().then((r) => r.data),
    table('orders', 'reference, status, provider, currency, total_amount, created_at, paid_at, refunded_at, order_items(title_snapshot, unit_amount, quantity, currency)', 'created_at'),
    table('entitlements', 'source, granted_at, expires_at, revoked_at, products(slug, title)', 'granted_at'),
    table('reading_progress', 'percent, audio_position_seconds, started_at, last_read_at, completed_at, stories(slug, title)', 'last_read_at'),
    table('saved_stories', 'created_at, stories(slug, title)', 'created_at'),
    table('bookmarks', 'note, char_offset, created_at, stories(slug, title), story_sections(title)', 'created_at'),
    table('saved_passages', 'quote, created_at, stories(slug, title), story_sections(title)', 'created_at'),
    table('journal_entries', 'title, body, visibility, created_at, updated_at, moods(label), stories(slug, title), story_sections(title), journal_prompts(body)', 'created_at'),
    supabase.from('user_settings').select('*').eq('user_id', viewer.id).maybeSingle().then((r) => r.data),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { email: viewer.email, display_name: viewer.displayName ?? profile?.display_name ?? null, bio: profile?.bio ?? null, member_since: profile?.created_at ?? null, role: viewer.role },
    settings,
    orders,
    library: { owned: entitlements, saved, reading, bookmarks, passages },
    journal,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="soulfables-${stamp}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

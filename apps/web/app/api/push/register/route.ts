import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().trim().regex(/^ExponentPushToken\[[A-Za-z0-9_-]+\]$/, 'Not an Expo push token.'),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(40).optional(),
});

/**
 * The app registers a device for notifications.
 *
 * Signed in with a bearer token, the app posts the token the phone gave
 * it. Written with the reader's own session, so the row policy keeps it
 * theirs. Posting the same token again refreshes last_seen_at. DELETE
 * with the same token forgets the device, for sign-out.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'sign_in' }, { status: 401 });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: viewer.id,
      token: parsed.token,
      platform: parsed.platform,
      app_version: parsed.appVersion ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'sign_in' }, { status: 401 });
  const token = new URL(request.url).searchParams.get('token') ?? '';
  if (!token) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const supabase = await createClient();
  await supabase.from('push_tokens').delete().eq('token', token).eq('user_id', viewer.id);
  return NextResponse.json({ ok: true });
}

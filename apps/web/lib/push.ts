import 'server-only';
import { createAdminClient } from './supabase/admin';

/**
 * Push notifications to the mobile app, through Expo's push service.
 *
 * Expo relays to Apple and Google, so the House needs no certificates
 * of its own: a token that begins ExponentPushToken[…] is enough.
 * Messages go in batches of a hundred, which is Expo's limit. A token
 * the service reports as gone is deleted, so the list stays honest.
 *
 * Nothing here throws to the caller: a notification that could not be
 * sent is a log line, never a failed page.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Where the app opens when the notification is tapped, as a site path. */
  path?: string;
};

const EXPO = 'https://exp.host/--/api/v2/push/send';

async function sendBatch(tokens: string[], message: PushMessage): Promise<string[]> {
  const res = await fetch(EXPO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((to) => ({
        to,
        title: message.title,
        body: message.body,
        sound: 'default',
        data: { path: message.path ?? '/' },
      })),
    ),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
  const dead: string[] = [];
  (json.data ?? []).forEach((r, i) => {
    if (r.status === 'error' && r.details?.error === 'DeviceNotRegistered') dead.push(tokens[i]);
  });
  return dead;
}

/** Send to every device of the given readers, or to every device when userIds is null. */
export async function sendPush(userIds: string[] | null, message: PushMessage): Promise<{ sent: number }> {
  try {
    const db = createAdminClient();
    let q = db.from('push_tokens').select('token');
    if (userIds) q = q.in('user_id', userIds);
    const { data } = await q;
    const tokens = (data ?? []).map((r) => r.token as string).filter((t) => /^ExponentPushToken\[/.test(t));
    let sent = 0;
    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += 100) {
      const batch = tokens.slice(i, i + 100);
      dead.push(...(await sendBatch(batch, message)));
      sent += batch.length;
    }
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);
    return { sent: sent - dead.length };
  } catch (e) {
    console.error('[push] send failed', e);
    return { sent: 0 };
  }
}

import 'server-only';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';

/**
 * Demo session identity.
 *
 * Two cookies, doing different jobs:
 *
 *   sf-demo-id      always present. Identifies which in-memory House this
 *                   browser is looking at, so two visitors to a shared
 *                   demo link do not read each other's journal.
 *   sf-demo-signed  set when someone "signs in" to the demo. There is no
 *                   password and no account — the whole point is to let
 *                   an evaluator see the signed-in surfaces.
 *
 * This is emphatically NOT authentication, and it is unreachable in live
 * mode: every caller checks isDemoMode() first. If this file ever ran
 * against a real database it would be a critical vulnerability, so it is
 * kept in lib/demo/ where that is obvious, and never imported by
 * lib/auth.ts without the mode check beside it.
 */

const ID_COOKIE = 'sf-demo-id';
const SIGNED_COOKIE = 'sf-demo-signed';

/**
 * Read the demo session id. Returns a stable fallback when there is no
 * cookie and none can be set — Server Components cannot write cookies,
 * so a first-time visitor reads from the shared 'anonymous' House until
 * middleware or an action assigns them one.
 */
export async function getDemoSessionId(): Promise<string> {
  const store = await cookies();
  return store.get(ID_COOKIE)?.value ?? 'demo-anonymous';
}

/** Called from middleware, which can write cookies. */
export function newDemoSessionId(): string {
  return `demo-${randomUUID()}`;
}

export const DEMO_ID_COOKIE = ID_COOKIE;
export const DEMO_SIGNED_COOKIE = SIGNED_COOKIE;

export async function isDemoSignedIn(): Promise<boolean> {
  const store = await cookies();
  return store.get(SIGNED_COOKIE)?.value === '1';
}

/** The persona an evaluator is looking through. */
export const DEMO_VIEWER = {
  id: 'demo-reader',
  email: 'reader@soulfables.demo',
  displayName: 'Amara',
  // Owner, so the admin is explorable. In live mode a new account is
  // always 'reader' and roles are granted deliberately.
  role: 'owner' as const,
};

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
const PERSONA_COOKIE = 'sf_demo_persona';
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
export const DEMO_PERSONA_COOKIE = PERSONA_COOKIE;

export async function isDemoSignedIn(): Promise<boolean> {
  const store = await cookies();
  return store.get(SIGNED_COOKIE)?.value === '1';
}

/**
 * The three people you can be in the demo.
 *
 * One account with every power shows you nothing about how the roles
 * differ, and the difference is the interesting part: an author writes
 * and submits but cannot publish; a reader has no studio at all. So the
 * sign-in page offers three, and the whole product changes depending on
 * which door you come through.
 *
 * The author's email matches the seeded author account in
 * lib/demo/editorial.ts, which is what links this persona to the Seren
 * Adair byline.
 */
export type DemoPersona = {
  id: string;
  email: string;
  displayName: string;
  role: 'reader' | 'author' | 'owner';
  /** Shown on the sign-in page. */
  blurb: string;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: 'demo-owner',
    email: 'apophia@soulfables.co',
    displayName: 'Apophia',
    role: 'owner',
    blurb:
      'Runs the House. The whole admin, plus the writing room — reviews submissions, publishes, releases chapters.',
  },
  {
    id: 'demo-author',
    email: 'seren@soulfables.co',
    displayName: 'Seren Adair',
    role: 'author',
    blurb:
      'Writes for the House. Has a studio and can submit work, but cannot publish it — that is the House’s decision.',
  },
  {
    id: 'demo-reader',
    email: 'reader@soulfables.demo',
    displayName: 'Amara',
    role: 'reader',
    blurb:
      'Just reads. A library, a journal nobody else can see, and a shelf of what she has kept.',
  },
];

export function personaFor(email: string | null | undefined): DemoPersona {
  const needle = (email ?? '').trim().toLowerCase();
  return (
    DEMO_PERSONAS.find((p) => p.email.toLowerCase() === needle) ??
    // Anything typed that is not one of the three is a plain reader —
    // the same as a real new account, which is never staff.
    { ...DEMO_PERSONAS[2], email: needle || DEMO_PERSONAS[2].email }
  );
}

/** Which persona this browser signed in as, if any. */
export async function currentDemoPersona(): Promise<DemoPersona | null> {
  const store = await cookies();
  if (store.get(SIGNED_COOKIE)?.value !== '1') return null;
  return personaFor(store.get(PERSONA_COOKIE)?.value);
}

/** Kept for the few places that only need "is anyone signed in". */
export const DEMO_VIEWER = DEMO_PERSONAS[0];

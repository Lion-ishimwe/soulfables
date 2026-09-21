import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { bearerToken, createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { currentDemoPersona } from './demo/session';

export type AppRole = 'reader' | 'author' | 'editor' | 'admin' | 'owner';

export type Viewer = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: AppRole;
  /** True when this identity came from the demo cookie, not from auth. */
  isDemo?: boolean;
};

/**
 * Who is reading, if anyone.
 *
 * In live mode this uses getUser(), which revalidates the token against
 * the auth server. getSession() only reads the cookie without verifying
 * it and must never gate access.
 *
 * In demo mode the identity comes from a cookie with no password behind
 * it. That is safe only because demo mode requires the absence of
 * Supabase credentials (or an explicit NEXT_PUBLIC_DEMO_MODE flag) — the
 * two paths can never both be live, and the demo path can never reach a
 * real database because there isn't one configured.
 */
/*
 * Memoised for the length of one request.
 *
 * The admin layout asks who you are, then asks again to decide what to
 * show, and then the page asks a third time. Each ask was two round
 * trips to Frankfurt — six requests to answer one question, and about
 * 1.8 seconds of a dashboard spent re-establishing the same identity.
 *
 * React's cache() deduplicates within a single render pass, so the
 * second and third callers get the first answer. It does NOT persist
 * across requests, which is exactly right: the next visitor asks again.
 */
export const getViewer = cache(async function getViewer(): Promise<Viewer | null> {
  if (isDemoMode()) {
    const persona = await currentDemoPersona();
    if (!persona) return null;
    return { ...persona, isDemo: true };
  }

  /*
   * A visitor with no session cookie has no session.
   *
   * Without this the House asked the auth server to identify every
   * anonymous reader of every public page — two round trips to Frankfurt
   * to be told, 600ms later, that nobody was signed in. The cookie's
   * absence is proof enough, and it is the one direction that cannot be
   * forged: a forged cookie still fails verification below, and a missing
   * one cannot invent a session.
   */
  const token = await bearerToken();
  const jar = await cookies();
  const hasSession = token !== null || jar.getAll().some((c) => /^sb-.*-auth-token/.test(c.name));
  if (!hasSession) return null;

  const supabase = await createClient();

  /*
   * Asked together. viewer_context() reads auth.uid() from the JWT, so
   * it does not need getUser() to have answered first — waiting for it
   * cost a round trip on every signed-in page for no information.
   */
  // With a bearer token there is no client-side session to read, so the
  // token itself is handed to getUser; the auth server verifies it.
  const [{ data: { user } }, { data: contextData }] = await Promise.all([
    token ? supabase.auth.getUser(token) : supabase.auth.getUser(),
    supabase.rpc('viewer_context'),
  ]);

  if (!user) return null;

  /*
   * One request for the display name and the role, not two.
   *
   * They are one question about one person, and from a machine 300ms
   * from the database two questions cost twice as much as one. The
   * getUser() above stays as it is — it verifies the token against the
   * auth server rather than trusting the cookie, and that is not a cost
   * worth saving.
   */
  const context = (contextData ?? {}) as { display_name?: string | null; role?: string | null };

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: context.display_name ?? null,
    role: (context.role as AppRole) ?? 'reader',
  };
});

/** For pages that require a reader. Middleware normally catches this first. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    redirect(next ? `/signin?next=${encodeURIComponent(next)}` : '/signin');
  }
  return viewer;
}

/**
 * For pages that require staff.
 *
 * Defence in depth: middleware already rewrote non-staff to a 404, and in
 * live mode RLS would return nothing anyway. This is the third layer, and
 * it is cheap.
 */
export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer('/admin');
  if (!['editor', 'admin', 'owner'].includes(viewer.role)) {
    redirect('/');
  }
  return viewer;
}

/**
 * Staff can publish. An author deliberately cannot — they write and
 * submit, and the House decides. That division is the entire reason the
 * review step exists, so `author` is absent from this list on purpose.
 */
export function isStaff(role: AppRole): boolean {
  return role === 'editor' || role === 'admin' || role === 'owner';
}

export function isAdmin(role: AppRole): boolean {
  return role === 'admin' || role === 'owner';
}

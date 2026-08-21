import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { isDemoSignedIn, DEMO_VIEWER } from './demo/session';

export type AppRole = 'reader' | 'editor' | 'admin' | 'owner';

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
export async function getViewer(): Promise<Viewer | null> {
  if (isDemoMode()) {
    if (!(await isDemoSignedIn())) return null;
    return { ...DEMO_VIEWER, isDemo: true };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).single(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? null,
    role: (roleRow?.role as AppRole) ?? 'reader',
  };
}

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

export function isStaff(role: AppRole): boolean {
  return role === 'editor' || role === 'admin' || role === 'owner';
}

export function isAdmin(role: AppRole): boolean {
  return role === 'admin' || role === 'owner';
}

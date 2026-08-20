import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';

export type AppRole = 'reader' | 'editor' | 'admin' | 'owner';

export type Viewer = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: AppRole;
};

/**
 * Who is reading, if anyone.
 *
 * Uses getUser(), which revalidates the token against the auth server.
 * getSession() reads the cookie without verifying it and must never be
 * used for anything that gates access.
 */
export async function getViewer(): Promise<Viewer | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

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
 * Defence in depth: middleware already rewrote non-staff to a 404, and
 * RLS would return nothing anyway. This is the third layer, and it is
 * cheap.
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

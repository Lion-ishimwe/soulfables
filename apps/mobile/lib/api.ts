import { SITE_URL } from './config';
import { supabase } from './supabase';

/**
 * Calls to the website's own API, signed with the reader's token.
 *
 * The site accepts "Authorization: Bearer <access token>" wherever it
 * accepts a session cookie, so the app uses the same routes the web
 * pages do: who am I, the narration address, the Librarian, push
 * registration. Nothing here is a second backend.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SITE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(await authHeaders()),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return (await res.json()) as T;
}

export type Me = {
  signedIn: boolean;
  displayName?: string;
  role?: string;
  isStaff: boolean;
  aiAccess?: boolean;
  savedSlugs: string[];
};

export const getMe = () => api<Me>('/api/me');

/** The signed address of a story's narration, good for a short while. */
export const narrationUrl = (slug: string) =>
  api<{ url: string; format: string; expiresIn: number }>(`/api/story/${encodeURIComponent(slug)}/audio?json=1`);

export const registerPush = (token: string, platform: 'ios' | 'android' | 'web', appVersion?: string) =>
  api<{ ok: true }>('/api/push/register', { method: 'POST', body: JSON.stringify({ token, platform, appVersion }) });

export const unregisterPush = (token: string) =>
  api<{ ok: true }>(`/api/push/register?token=${encodeURIComponent(token)}`, { method: 'DELETE' });

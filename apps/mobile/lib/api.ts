import { SITE_URL } from './config';
import { supabase } from './supabase';

/**
 * Calls to the website's own API, signed with the reader's token.
 *
 * The site accepts "Authorization: Bearer <access token>" wherever it
 * accepts a session cookie, so the app uses the same routes the web
 * pages do: who am I, the narration address, the Librarian, downloads,
 * push registration, and the error log. Nothing here is a second backend.
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

/** The signed address of a bought file, good for a short while. */
export const downloadUrl = (fileId: string) => api<{ url: string }>(`/api/download/${encodeURIComponent(fileId)}?json=1`);

export const registerPush = (token: string, platform: 'ios' | 'android' | 'web', appVersion?: string) =>
  api<{ ok: true }>('/api/push/register', { method: 'POST', body: JSON.stringify({ token, platform, appVersion }) });

export const unregisterPush = (token: string) =>
  api<{ ok: true }>(`/api/push/register?token=${encodeURIComponent(token)}`, { method: 'DELETE' });

// --- The Librarian ----------------------------------------------------

export type CompanionMessage = {
  role: 'user' | 'assistant';
  content: string;
  safety?: 'crisis' | null;
  suggestions?: { slug: string; title: string }[];
  generated?: boolean;
};

/** One turn of the conversation. The site decides rule-based or model, by standing. */
export const askLibrarian = (messages: CompanionMessage[]) =>
  api<CompanionMessage>('/api/companion', { method: 'POST', body: JSON.stringify({ messages: messages.map((m) => ({ role: m.role, content: m.content })) }) });

// --- Errors -----------------------------------------------------------

/** A failure in the app, told to the House's error log. Never throws. */
export async function reportError(error: unknown, where: string): Promise<void> {
  try {
    const e = error as { message?: string; stack?: string };
    await fetch(`${SITE_URL}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `[app] ${String(e?.message ?? error).slice(0, 1800)}`, stack: typeof e?.stack === 'string' ? e.stack.slice(0, 8000) : null, path: where, reloading: false }),
    });
  } catch {
    /* an error while recording an error is not worth a third one */
  }
}

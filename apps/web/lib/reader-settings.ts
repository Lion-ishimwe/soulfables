import 'server-only';
import { getViewer, isStaff } from './auth';
import { isDemoMode } from './demo/mode';
import { hasPremiumAccess } from './membership';
import { createClient } from './supabase/server';

/**
 * A reader's own theme.
 *
 * Premium readers may wear a palette of their own over the House's. The
 * choice lives in user_settings.reader_theme; the root layout asks for
 * it once per request and puts it on <html>, where the House's own
 * theme would otherwise go. Free readers, and readers who have not
 * chosen, see the House's theme.
 */

export const READER_THEMES = ['dark', 'light', 'sepia'] as const;
export type ReaderTheme = (typeof READER_THEMES)[number];

export function isReaderTheme(v: unknown): v is ReaderTheme {
  return typeof v === 'string' && (READER_THEMES as readonly string[]).includes(v);
}

/** The theme to put on <html> for this reader, or null to use the House's. */
export async function getReaderTheme(): Promise<ReaderTheme | null> {
  if (isDemoMode()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  const allowed = isStaff(viewer.role) || (await hasPremiumAccess());
  if (!allowed) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('user_settings').select('reader_theme').eq('user_id', viewer.id).maybeSingle();
  const t = data?.reader_theme;
  return isReaderTheme(t) ? t : null;
}

/** What the reader has chosen, whether or not they may currently wear it. */
export async function getChosenTheme(): Promise<ReaderTheme | null> {
  if (isDemoMode()) return null;
  const viewer = await getViewer();
  if (!viewer) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('user_settings').select('reader_theme').eq('user_id', viewer.id).maybeSingle();
  const t = data?.reader_theme;
  return isReaderTheme(t) ? t : null;
}

import 'server-only';
import { getViewer, isStaff } from '../auth';
import { isDemoMode } from '../demo/mode';
import { viewerAuthorSlug } from '../can-edit';
import { createClient } from '../supabase/server';

/**
 * May this person use the writing assistant?
 *
 * Staff always: it is their budget and their House. An author only when
 * somebody in Settings → Access has said so — the flag lives on the
 * author record (0031) and the rule lives in the database as
 * writing_ai_allowed(), so this is one question asked in one place.
 *
 * Every door to the assistant asks it: the Ask AI panel, the concept
 * panel, the draft jobs, and the header button that opens the first.
 * A door that did not would be the one an author finds.
 */
export async function canUseAI(): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (isStaff(viewer.role)) return true;

  // The demo has no flag to flip; an author there is a writer with a desk.
  if (isDemoMode()) return Boolean(await viewerAuthorSlug());

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('writing_ai_allowed');
  if (error) {
    console.error('[ai] writing_ai_allowed', error.message);
    return false;
  }
  return data === true;
}

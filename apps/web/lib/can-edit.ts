import 'server-only';
import { getViewer, isStaff } from './auth';
import { isDemoMode } from './demo/mode';
import { myAuthor } from './author-accounts';

/**
 * Who may write a given story.
 *
 * Moved out of actions/workflow.ts, where it was a private helper inside
 * a 'use server' file — exporting it from there would have turned a
 * permission check into a client-callable server action, which is the
 * wrong shape for the thing that decides permissions.
 *
 * It was also demo-only, and that mattered more. The author branch read
 * the demo store, which is empty in live mode, so every author was
 * denied every story they had been assigned. Staff never saw it because
 * they return true a line earlier — the branch that was broken was the
 * one nobody testing as an owner would reach.
 */

/** The author record belonging to whoever is signed in, if any. */
export async function viewerAuthorSlug(): Promise<string | null> {
  if (isDemoMode()) {
    const viewer = await getViewer();
    if (!viewer?.email) return null;
    const { demoAccountFor } = await import('./demo/editorial');
    return demoAccountFor(viewer.email)?.authorSlug ?? null;
  }

  const mine = await myAuthor();
  return mine?.slug ?? null;
}

/** Staff, or the author this story is currently assigned to. */
export async function canEditStory(storySlug: string): Promise<boolean> {
  const viewer = await getViewer();
  if (!viewer) return false;
  if (isStaff(viewer.role)) return true;

  const mine = await viewerAuthorSlug();
  if (!mine) return false;

  if (isDemoMode()) {
    const { demoGetStory } = await import('./demo/editorial');
    const story = demoGetStory(storySlug);
    return Boolean(story && story.assignedAuthorSlug === mine);
  }

  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();

  /*
   * Assigned, not bylined. A story handed on keeps the name of whoever
   * began it while the work moves to somebody else — so the byline is
   * who gets credit and the assignment is who may type.
   */
  const { data } = await supabase
    .from('stories')
    .select('assigned:authors!stories_assigned_author_id_fkey(slug)')
    .eq('slug', storySlug)
    .maybeSingle();

  const assigned = data?.assigned as { slug?: string } | { slug?: string }[] | null;
  const slug = Array.isArray(assigned) ? assigned[0]?.slug : assigned?.slug;

  return slug === mine;
}

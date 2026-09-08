import { NextResponse } from 'next/server';
import { getViewer, isStaff } from '@/lib/auth';
import { getSavedStories } from '@/lib/library';
import { canUseAI } from '@/lib/ai/access';

/**
 * Who the browser is, from the server's point of view.
 *
 * This exists so reader controls can know their own state without
 * dragging the whole page out of static generation. The story pages are
 * prerendered — they are the pages that most need to be fast and
 * indexable — so they cannot read cookies. This endpoint can.
 *
 * It also means the client stops guessing. The previous version inferred
 * "signed in" from whether a Supabase URL was configured, which was wrong
 * in demo mode and would have been wrong in live mode the moment a
 * session expired.
 *
 * Returns nothing identifying beyond what the reader already knows about
 * themselves, and is never cached.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json(
      { signedIn: false, isStaff: false, savedSlugs: [] },
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  }

  const [saved, aiAccess] = await Promise.all([getSavedStories(), canUseAI()]);

  return NextResponse.json(
    {
      signedIn: true,
      displayName: viewer.displayName,
      role: viewer.role,
      isStaff: isStaff(viewer.role),
      // Whether the header shows Ask AI. Staff always; authors when the
      // House has switched it on for them (Settings → Access).
      aiAccess,
      isDemo: Boolean(viewer.isDemo),
      savedSlugs: saved.map((s) => s!.slug),
    },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );
}

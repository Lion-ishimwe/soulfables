import { NextResponse, type NextRequest } from 'next/server';
import { requireViewer } from '@/lib/auth';
import { getShelves } from '@/lib/content';
import { buildTemplate, TEMPLATE_FILENAME } from '@/lib/story-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * Download the writing template.
 *
 * Generated rather than served from disk so the shelf list inside it is
 * always the real one — a template listing shelves that no longer exist
 * is worse than no template.
 */
export async function GET(request: NextRequest) {
  await requireViewer('/studio');
  const shelves = await getShelves();

  /*
   * A concept chosen in the Writing Room arrives here as query
   * parameters and leaves as a pre-filled file. Everything is bounded
   * and the shelf must be real; anything else falls back to the blank
   * template rather than to an error, since the worst case is a writer
   * who has to type their own title.
   */
  const q = request.nextUrl.searchParams;
  const take = (name: string, max: number) => (q.get(name) ?? '').trim().slice(0, max) || undefined;
  const shelf = take('shelf', 60)?.toLowerCase();
  const premise = take('premise', 1500);
  const sections = q
    .getAll('section')
    .map((s) => s.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 8);

  const body = buildTemplate({
    title: take('title', 200),
    subtitle: take('subtitle', 200),
    shelf: shelf && shelves.some((s) => s.slug === shelf) ? shelf : undefined,
    release: q.get('release') === 'serial' ? 'serial' : undefined,
    concept: premise
      ? { premise, opening: take('opening', 1000) ?? '', sections }
      : undefined,
    shelves: shelves.map((s) => ({ slug: s.slug, label: s.label })),
  });

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${TEMPLATE_FILENAME}"`,
      'Cache-Control': 'no-store',
    },
  });
}

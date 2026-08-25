import { NextResponse } from 'next/server';
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
export async function GET() {
  await requireViewer('/studio');
  const shelves = await getShelves();

  const body = buildTemplate({
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

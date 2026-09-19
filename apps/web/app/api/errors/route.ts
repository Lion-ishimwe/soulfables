import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitFor, MINUTE } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
  digest: z.string().max(200).nullable().optional(),
  stack: z.string().max(8000).nullable().optional(),
  path: z.string().max(500).nullable().optional(),
  reloading: z.boolean().optional(),
});

/**
 * Where a browser tells the House that a page broke.
 *
 * The server already records its own failures (instrumentation.ts) in
 * app_errors; this gives the client the same book. It takes a message,
 * an optional digest and stack and the path, and nothing else — no
 * headers, no cookies, nothing typed into a form. Anyone can post here,
 * so it is rate-limited by address and the row is capped in size; a
 * flood costs a few rows, not a table.
 */
export async function POST(request: NextRequest) {
  const limit = await limitFor('errors', null, 20, 10 * MINUTE);
  if (!limit.ok) return new NextResponse(null, { status: 429 });

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    await supabase.from('app_errors').insert({
      message: parsed.message,
      digest: parsed.digest ?? null,
      stack: parsed.stack ?? null,
      path: parsed.path ?? null,
      method: parsed.reloading ? 'reload' : null,
      kind: 'client',
      runtime: 'browser',
    });
  } catch {
    /* the reader's page matters more than the note about it */
  }

  return new NextResponse(null, { status: 204 });
}

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  buildContext,
  getCompanionProvider,
  screenForDistress,
  CRISIS_RESPONSE,
  type CompanionMessage,
} from '@/lib/ai/companion';
import { getViewer } from '@/lib/auth';
import { limitFor, HOUR, waitMessage } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      }),
    )
    .max(40),
});

/**
 * The companion endpoint.
 *
 * The safety screen runs first, on the reader's own words, before any
 * provider is constructed. A flagged message never reaches a model at
 * all — which is the difference between a safety policy and a safety
 * mechanism.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: 'sign-in-required' }, { status: 401 });
  }

  const limit = await limitFor('companion', viewer.id, 120, HOUR);
  if (!limit.ok) {
    return NextResponse.json(
      { role: 'assistant', content: waitMessage(limit) } satisfies CompanionMessage,
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const history = parsed.data.messages as CompanionMessage[];
  const latest = [...history].reverse().find((m) => m.role === 'user');

  if (latest && screenForDistress(latest.content)) {
    return NextResponse.json(
      {
        role: 'assistant',
        content: CRISIS_RESPONSE,
        safety: 'crisis',
      } satisfies CompanionMessage,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const [provider, context] = await Promise.all([
    getCompanionProvider(),
    buildContext(),
  ]);

  const reply = await provider.reply(history, context);

  return NextResponse.json(reply, { headers: { 'Cache-Control': 'no-store' } });
}

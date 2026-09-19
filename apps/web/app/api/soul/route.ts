import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getViewer } from '@/lib/auth';
import { canUseSoulAI } from '@/lib/ai/access';
import { claudeConfigured } from '@/lib/ai/claude';
import { screenForDistress, CRISIS_RESPONSE } from '@/lib/ai/companion';
import { storyForFeeling } from '@/lib/ai/soul';
import { isDemoMode } from '@/lib/demo/mode';
import { limitFor, HOUR, waitMessage } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  feeling: z.string().trim().min(2, 'Say a little more.').max(300),
});

/**
 * Soul AI: a story for how somebody feels.
 *
 * Order of checks, and why: sign-in, then the plan, then the safety
 * screen on the reader's words, then the rate limit, then the model.
 * The screen sits before the limit so a person in a bad way is never
 * told to wait an hour; they get the crisis reply at once.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: 'sign-in-required' }, { status: 401 });

  if (!(await canUseSoulAI())) {
    return NextResponse.json({ error: 'premium-required' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'bad request' }, { status: 400 });
  }

  if (screenForDistress(parsed.data.feeling)) {
    return NextResponse.json({ safety: 'crisis', content: CRISIS_RESPONSE }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Ten stories a day is a generous evening; it is also a ceiling on
  // what one account can cost the House.
  const limit = await limitFor('soul-story', viewer.id, 10, 24 * HOUR);
  if (!limit.ok) {
    return NextResponse.json({ error: waitMessage(limit) }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  }

  if (isDemoMode() || !claudeConfigured()) {
    // The demo has no model. It still shows the shape of the thing.
    return NextResponse.json(
      {
        generated: true,
        result: {
          title: 'The Lamp That Stayed On',
          story:
            'She left the lamp on in the hallway the night he went, and did not turn it off in the morning. It was an ordinary bulb. It had been changed on a Sunday, standing on a kitchen chair, with somebody holding the back of it.\n\nThe bill came and she paid it. The bulb did not burn out, which surprised her, because everything else had. She stopped expecting it to. In November a neighbour asked if she was all right, and she said she was, and then, because the neighbour did not move, she said that she was mostly all right in the daytime.\n\nThe lamp was still on when she got home. It had been on for nine months, which is long enough to grow something.',
          lesson:
            'Some things keep going without being asked to. Noticing them is not the same as being fine, and it is not nothing either.',
          question: 'What lived in the room with you, long after they were gone?',
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const outcome = await storyForFeeling(parsed.data.feeling);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: 502 });

  return NextResponse.json({ generated: true, result: outcome.result }, { headers: { 'Cache-Control': 'no-store' } });
}

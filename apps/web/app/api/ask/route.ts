import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getViewer } from '@/lib/auth';
import { canEditStory } from '@/lib/can-edit';
import { canUseAI } from '@/lib/ai/access';
import { getWorkStory } from '@/lib/admin-data';
import { askWriter, writingAvailable } from '@/lib/ai/writing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
  storySlug: z.string().trim().max(200).optional(),
});

/**
 * Ask AI, for the Writing Room.
 *
 * A route rather than a server action because a conversation is a
 * request-response pair the panel makes on its own, not a form. It is
 * gated the way the assistant's other jobs are: staff, or a writer with
 * a desk — and if a story is named, only someone allowed to write it.
 *
 * Nothing here touches a story. The reply goes back to the panel and
 * stays there until the writer decides what, if anything, to do with it.
 */
export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: 'sign-in-required' }, { status: 401 });
  }

  if (!(await canUseAI())) {
    return NextResponse.json(
      { error: 'The House has not switched the writing assistant on for your desk.' },
      { status: 403 },
    );
  }

  if (!writingAvailable()) {
    return NextResponse.json(
      { error: 'No AI provider is connected. Settings → Billing shows what is missing.' },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }

  const { messages, storySlug } = parsed.data;

  let story: Awaited<ReturnType<typeof getWorkStory>> = null;
  if (storySlug) {
    if (!(await canEditStory(storySlug))) {
      return NextResponse.json({ error: 'That story is not yours to write.' }, { status: 403 });
    }
    story = await getWorkStory(storySlug);
  }

  const result = await askWriter({
    messages,
    story: story
      ? {
          slug: story.slug,
          title: story.title,
          subtitle: story.subtitle,
          shelfSlug: story.shelfSlug || undefined,
          body: story.bodyMdx,
        }
      : null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json(
    { role: 'assistant', content: result.text },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

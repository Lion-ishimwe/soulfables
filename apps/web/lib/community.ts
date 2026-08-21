import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { getStories } from './content';

/**
 * Reader voices.
 *
 * Unsigned by design (brief §9 of the live site's own copy: "people leave
 * a line and don't sign their name"). The schema keeps user_id so a
 * person can withdraw their own line and so abuse can be handled, but it
 * is never selected here and never rendered.
 */
export type Voice = {
  id: string;
  body: string;
  storySlug: string | null;
  storyTitle: string | null;
};

const DEMO_VOICES: { id: string; body: string; storySlug: string | null }[] = [
  {
    id: 'v1',
    body: 'I read about a stranger who was kind to someone without knowing why, and I realised I was kind to a stranger last Tuesday, and I did not know why either.',
    storySlug: null,
  },
  {
    id: 'v2',
    body: 'The kettle boiling for one. I had to put my phone down for a minute.',
    storySlug: 'the-house-after-you-left',
  },
  {
    id: 'v3',
    body: 'I have been keeping a seed in a drawer for nine years. I did not know that was a thing other people did.',
    storySlug: 'the-seed-i-was-afraid-to-plant',
  },
  {
    id: 'v4',
    body: 'Read this on a night bus and had to look out of the window for a while.',
    storySlug: 'the-last-voice-note',
  },
];

export async function getReaderVoices(): Promise<Voice[]> {
  if (isDemoMode()) {
    const stories = await getStories();
    return DEMO_VOICES.map((v) => ({
      id: v.id,
      body: v.body,
      storySlug: v.storySlug,
      storyTitle: v.storySlug
        ? (stories.find((s) => s.slug === v.storySlug)?.title ?? null)
        : null,
    }));
  }

  const supabase = await createClient();
  const { data } = await supabase
    // Note the absence of user_id. Unsigned means unsigned.
    .from('reader_voices')
    .select('id, body, stories(slug, title)')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).map((v: Record<string, unknown>) => {
    const story = v.stories as { slug?: string; title?: string } | null;
    return {
      id: v.id as string,
      body: v.body as string,
      storySlug: story?.slug ?? null,
      storyTitle: story?.title ?? null,
    };
  });
}

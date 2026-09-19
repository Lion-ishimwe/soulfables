import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';
import { getViewer } from './auth';

/**
 * Guided journals: a journey of prompts, one a day.
 *
 * The journals and their steps are the House's, public to read and
 * changed by staff. Where a reader has got to is theirs alone, one row
 * per reader and journal, moved on when they save a reflection to a
 * day's prompt. Premium starts a journey; anyone may read what one is.
 */

export type GuidedJournal = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  days: number;
};

export type GuidedStep = { day: number; prompt: string };

export type GuidedProgress = { startedAt: string; lastDay: number };

const DEMO: (GuidedJournal & { steps: GuidedStep[] })[] = [
  {
    id: 'demo-guided-1',
    slug: 'seven-nights-after-a-loss',
    title: 'Seven Nights After a Loss',
    description: 'One page a night, for the week nobody tells you how to get through. Nothing to fix. Somewhere to put it.',
    days: 7,
    steps: [
      { day: 1, prompt: 'Write down what today was like, plainly, as if to someone who was not there.' },
      { day: 2, prompt: 'What did they do that nobody else does? One thing. Describe it exactly.' },
      { day: 3, prompt: 'What are people saying to you that does not help? What would?' },
      { day: 4, prompt: 'Where in the house, or the day, is the absence loudest?' },
      { day: 5, prompt: 'What is one thing you have done this week that you could not have done last week?' },
      { day: 6, prompt: 'If you could ask them one question now, what would it be? Write their answer as you think they would give it.' },
      { day: 7, prompt: 'What do you want to keep? Not everything. One thing.' },
    ],
  },
  {
    id: 'demo-guided-2',
    slug: 'beginning-again',
    title: 'Beginning Again',
    description: 'Seven mornings for a change you did not choose, or one you did and are frightened of anyway.',
    days: 7,
    steps: [
      { day: 1, prompt: 'What is ending, and what have you not said about it yet?' },
      { day: 2, prompt: 'What did the old life ask of you that you will not miss?' },
      { day: 3, prompt: 'What are you afraid the new one will ask?' },
      { day: 4, prompt: 'Who do you become when nobody remembers who you were?' },
      { day: 5, prompt: 'Write the first ordinary day of the new life, hour by hour.' },
      { day: 6, prompt: 'What would you tell someone standing where you stood a month ago?' },
      { day: 7, prompt: 'What will you carry forward, and what will you set down at the door?' },
    ],
  },
];

async function fetchJournals(): Promise<(GuidedJournal & { steps: GuidedStep[] })[]> {
  if (isDemoMode()) return DEMO;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('guided_journals')
    .select('id, slug, title, description, guided_journal_steps(day, prompt)')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[guided] list', error.message);
    return [];
  }
  return (data ?? []).map((r) => {
    const steps = (((r.guided_journal_steps as { day: number; prompt: string }[]) ?? []) as GuidedStep[]).sort((a, b) => a.day - b.day);
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      description: (r.description as string) ?? null,
      days: steps.length,
      steps,
    };
  });
}

export const getGuidedJournals = unstable_cache(fetchJournals, ['guided-journals'], { revalidate: 60, tags: ['content'] });

export async function getGuidedJournal(slug: string) {
  return (await getGuidedJournals()).find((j) => j.slug === slug) ?? null;
}

/** Where this reader has got to, for every journey they have begun. */
export async function getGuidedProgress(): Promise<Record<string, GuidedProgress>> {
  if (isDemoMode()) return {};
  const viewer = await getViewer();
  if (!viewer) return {};
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase
    .from('guided_journal_progress')
    .select('started_at, last_day, guided_journals(slug)')
    .eq('user_id', viewer.id);
  const out: Record<string, GuidedProgress> = {};
  for (const r of (data ?? []) as { started_at: string; last_day: number; guided_journals: { slug?: string } | null }[]) {
    const slug = r.guided_journals?.slug;
    if (slug) out[slug] = { startedAt: r.started_at, lastDay: Number(r.last_day ?? 0) };
  }
  return out;
}

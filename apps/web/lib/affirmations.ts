import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';
import { createClient, createPublicClient } from './supabase/server';

/**
 * Affirmations: one calm line a day.
 *
 * Chosen by the date, like the question of the day, so everyone sees
 * the same line all day and it changes at midnight. Free for every
 * reader; the Librarian may also offer one in conversation.
 */

export type Affirmation = { id: string; body: string };
export type AdminAffirmation = Affirmation & { isActive: boolean; sortOrder: number };

export const DEMO_AFFIRMATIONS: Affirmation[] = [
  { id: 'demo-aff-1', body: 'You are allowed to take up the room you are in.' },
  { id: 'demo-aff-2', body: 'Nothing you feel tonight has to be fixed by morning.' },
  { id: 'demo-aff-3', body: 'Slowness is not the same as falling behind.' },
  { id: 'demo-aff-4', body: 'You have survived every night so far.' },
  { id: 'demo-aff-5', body: 'What you carry is heavy because it mattered.' },
  { id: 'demo-aff-6', body: 'You can be unfinished and still be whole.' },
  { id: 'demo-aff-7', body: 'The quiet is not empty. It is where you can hear yourself.' },
];

async function fetchActive(): Promise<Affirmation[]> {
  if (isDemoMode()) return DEMO_AFFIRMATIONS;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('affirmations')
    .select('id, body')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[affirmations] fetch', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id as string, body: r.body as string }));
}

export const getAffirmations = unstable_cache(fetchActive, ['affirmations'], {
  revalidate: 60,
  tags: ['content'],
});

/** Today's line, the same for everyone until midnight. */
export async function getAffirmationOfTheDay(): Promise<Affirmation | null> {
  const all = await getAffirmations();
  if (all.length === 0) return null;
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return all[dayIndex % all.length];
}

/** Every line, put away or not. Staff only. */
export async function listAdminAffirmations(): Promise<AdminAffirmation[]> {
  if (isDemoMode()) {
    return DEMO_AFFIRMATIONS.map((a, i) => ({ ...a, isActive: true, sortOrder: i + 1 }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('affirmations')
    .select('id, body, is_active, sort_order')
    .order('sort_order')
    .order('created_at');
  if (error) {
    console.error('[affirmations] list', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    body: r.body as string,
    isActive: r.is_active !== false,
    sortOrder: Number(r.sort_order ?? 0),
  }));
}

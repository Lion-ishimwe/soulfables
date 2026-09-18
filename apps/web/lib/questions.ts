import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';
import { createClient, createPublicClient } from './supabase/server';

/**
 * The drawer of quiet questions.
 *
 * A card is a journal prompt with a face. Readers draw one at random,
 * write what comes, and keep it in their journal against the card. The
 * cards live in journal_prompts with kind = 'deck', so the House's staff
 * add and change them where they change the rest of what the House
 * asks, and a reflection written to a card counts like any other.
 */

export type Card = {
  id: string;
  title: string;
  feeling: string;
  whisper: string | null;
  body: string;
  /** An optional mark for the face. Empty means the House's star. */
  glyph: string | null;
};

export type AdminCard = Card & {
  isActive: boolean;
  sortOrder: number;
  /** Reflections written to this card. A fact about the card, never about a person. */
  uses: number;
};

/** The twelve from the first House, for the demo and for the seed's memory. */
export const DEMO_CARDS: Card[] = [
  { id: 'demo-card-1', title: 'The Sentence', feeling: 'Memory', whisper: 'A single sentence can reach you across years.', body: 'What line from a story still follows you today?', glyph: null },
  { id: 'demo-card-2', title: 'One Deep Breath', feeling: 'Presence', whisper: 'One breath can hold an entire night.', body: 'What made a whole night disappear into one breath?', glyph: null },
  { id: 'demo-card-3', title: 'The Forgotten Self', feeling: 'Identity', whisper: 'We put away what we can’t name, and it waits.', body: 'What is the part of your soul you’ve learned to put away?', glyph: null },
  { id: 'demo-card-4', title: 'The Unspoken', feeling: 'Self', whisper: 'Some names are given. Others are discovered.', body: 'Which part of yourself have you kept hidden because the world wasn’t ready to meet it?', glyph: null },
  { id: 'demo-card-5', title: 'The Stranger', feeling: 'Compassion', whisper: 'Every stranger carries a story you’ll never fully know.', body: 'When have you been kind to someone without knowing what they were carrying?', glyph: null },
  { id: 'demo-card-6', title: 'The Mend', feeling: 'Healing', whisper: 'Healing rarely arrives all at once.', body: 'What is the smallest thing that mends a hole in a heart?', glyph: null },
  { id: 'demo-card-7', title: 'The Way Home', feeling: 'Hope', whisper: 'Someone always carries you home, even when you forget the way.', body: 'When was the last time someone carried you home?', glyph: null },
  { id: 'demo-card-8', title: 'The Carrying', feeling: 'Heart', whisper: 'Some people carry us long after they’ve gone.', body: 'What did you hold someone through a season?', glyph: null },
  { id: 'demo-card-9', title: 'The Shelf', feeling: 'Library', whisper: 'Stories often find us before we know what we’re looking for.', body: 'Which shelf keeps calling your name?', glyph: null },
  { id: 'demo-card-10', title: 'The Silence', feeling: 'Connection', whisper: 'Silence between two people is never empty — it carries everything.', body: 'When was the silence between two people its own language?', glyph: null },
  { id: 'demo-card-11', title: 'The Empty Room', feeling: 'Grief', whisper: 'Some rooms never stop remembering.', body: 'What lived in the room with you, long after they were gone?', glyph: null },
  { id: 'demo-card-12', title: 'The Turning Tide', feeling: 'Becoming', whisper: 'Every tide carries what we bury beneath it.', body: 'What small moment became the beginning of a different life?', glyph: null },
];

function cardOf(r: Record<string, unknown>): Card {
  return {
    id: r.id as string,
    title: (r.title as string) ?? 'A quiet question',
    feeling: (r.feeling as string) ?? '',
    whisper: (r.whisper as string) ?? null,
    body: r.body as string,
    glyph: (r.glyph as string) ?? null,
  };
}

async function fetchCards(): Promise<Card[]> {
  if (isDemoMode()) return DEMO_CARDS;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('journal_prompts')
    .select('id, title, feeling, whisper, body, glyph')
    .eq('kind', 'deck')
    .eq('is_active', true)
    .order('sort_order')
    .order('created_at');

  if (error) {
    console.error('[questions] getCards', error.message);
    return [];
  }
  return (data ?? []).map((r) => cardOf(r as Record<string, unknown>));
}

/** The cards a reader may draw. Cached with the rest of the content; saving a card clears it. */
export const getCards = unstable_cache(fetchCards, ['quiet-questions'], {
  revalidate: 60,
  tags: ['content'],
});

/** Every card, put away or not, with how many reflections each has gathered. Staff only. */
export async function listAdminCards(): Promise<AdminCard[]> {
  if (isDemoMode()) {
    return DEMO_CARDS.map((c, i) => ({ ...c, isActive: true, sortOrder: i + 1, uses: 0 }));
  }

  const supabase = await createClient();
  const [cardsRes, usesRes] = await Promise.all([
    supabase
      .from('journal_prompts')
      .select('id, title, feeling, whisper, body, glyph, is_active, sort_order, created_at')
      .eq('kind', 'deck')
      .order('sort_order')
      .order('created_at'),
    supabase.from('journal_entries').select('prompt_id'),
  ]);

  if (cardsRes.error) {
    console.error('[questions] listAdminCards', cardsRes.error.message);
    return [];
  }

  const uses = new Map<string, number>();
  for (const e of (usesRes.data ?? []) as { prompt_id: string | null }[]) {
    if (e.prompt_id) uses.set(e.prompt_id, (uses.get(e.prompt_id) ?? 0) + 1);
  }

  return (cardsRes.data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      ...cardOf(row),
      isActive: row.is_active !== false,
      sortOrder: Number(row.sort_order ?? 0),
      uses: uses.get(row.id as string) ?? 0,
    };
  });
}

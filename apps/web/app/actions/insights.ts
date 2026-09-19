'use server';

import { requireViewer } from '@/lib/auth';
import { canUseSoulAI } from '@/lib/ai/access';
import { claudeConfigured } from '@/lib/ai/claude';
import { journalInsights } from '@/lib/ai/insights';
import { isDemoMode } from '@/lib/demo/mode';
import { getEntries } from '@/lib/journal';
import { limitFor, HOUR, waitMessage } from '@/lib/rate-limit';

export type InsightsState = { text?: string; error?: string; locked?: boolean };

/**
 * "What do you notice in what I have written?"
 *
 * Reads the reader's own recent entries, with their own session and at
 * their own request, and returns observations. Nothing is stored. A
 * few entries are needed before there is anything to notice.
 */
export async function askForInsights(_prev: InsightsState, _formData: FormData): Promise<InsightsState> {
  const viewer = await requireViewer('/journal');

  if (!(await canUseSoulAI())) return { locked: true };

  const limit = await limitFor('journal-insights', viewer.id, 5, 24 * HOUR);
  if (!limit.ok) return { error: waitMessage(limit) };

  const entries = await getEntries(30);
  if (entries.length < 3) {
    return { error: 'Write three reflections first. There is not enough on the page yet to notice a pattern in.' };
  }

  if (isDemoMode() || !claudeConfigured()) {
    return {
      text:
        'You have been writing about rooms and what stays in them after somebody leaves. Your entries keep returning to the evening, and to one story more than the others. Lately you name the feeling before you describe it, which you did not do in the earlier pages.\n\nOne thing to write to\n\n“What is the smallest thing that mends a hole in a heart?” It fits because your entries notice small things already; this asks what they are for.\n\nThis is a reading of your words, not a conclusion about you.',
    };
  }

  const result = await journalInsights(entries);
  return result.ok ? { text: result.text } : { error: result.error };
}

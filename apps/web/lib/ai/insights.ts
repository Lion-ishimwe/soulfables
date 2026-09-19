import 'server-only';
import { ask } from './claude';
import { getCards } from '../questions';
import type { Entry } from '../journal';

/**
 * Journal insights: patterns in a reader's own writing, when they ask.
 *
 * Three rules, each with a mechanism rather than a promise:
 *
 *   1. Nothing is read until the reader presses the button. The journal
 *      is sealed by a database rule even from staff; this reads it with
 *      the reader's own session, at their request, and only then.
 *   2. Nothing is kept. The observations go back to the page and are not
 *      stored anywhere; the usage meter records tokens, not text.
 *   3. The prompt forbids conclusions. What comes back is "you have been
 *      writing about", never "you are". A reading of their words, not a
 *      verdict on them, and it says so at the end.
 */

const SYSTEM = `You are the Librarian of Soulfables. A reader has asked you to notice patterns in their own journal. You are reading their words at their request.

Reply with three to five short observations, one sentence each. Each begins with "You have been writing about", "Your entries", "Lately you", or "You keep returning to". Notice themes, feelings named, people or places that recur, stories they come back to, times when they write. Be specific and quote a phrase of theirs where it helps.

Never diagnose. Never name a condition. Never tell them what they should do. Do not mention therapy, doctors or medication unless they wrote about those themselves. Do not praise. Do not summarise every entry.

Then, under a line reading "One thing to write to", offer exactly one reflection question from the list you are given, quoted word for word, and one sentence on why it might fit what you noticed.

End with this sentence, exactly: "This is a reading of your words, not a conclusion about you."

Under 220 words. Plain paragraphs, no headings, no bullet points.`;

const MAX_ENTRIES = 30;
const MAX_CHARS_PER_ENTRY = 700;
const MAX_TOTAL_CHARS = 14_000;

export type InsightsResult = { ok: true; text: string } | { ok: false; error: string };

export async function journalInsights(entries: Entry[]): Promise<InsightsResult> {
  const cards = await getCards();
  const questions = cards.map((c) => `- ${c.body}`).join('\n');

  let total = 0;
  const lines: string[] = [];
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    const body = e.body.replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS_PER_ENTRY);
    const line = `[${e.createdAt.slice(0, 10)}]${e.moodLabel ? ` (${e.moodLabel})` : ''}${e.storyTitle ? ` about “${e.storyTitle}”` : ''}: ${body}`;
    if (total + line.length > MAX_TOTAL_CHARS) break;
    total += line.length;
    lines.push(line);
  }

  const result = await ask({
    system: `${SYSTEM}\n\nQuestions you may offer:\n${questions}`,
    prompt: `My journal, newest first:\n\n${lines.join('\n\n')}`,
    job: 'journal-insights',
    maxTokens: 700,
  });
  return result.ok ? { ok: true, text: result.text.trim() } : { ok: false, error: result.error };
}

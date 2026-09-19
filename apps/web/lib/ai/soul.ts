import 'server-only';
import { ask } from './claude';
import { getCards } from '../questions';

/**
 * Soul AI: a story for how somebody feels.
 *
 * A reader says "I'm feeling betrayed" and receives three things: a short
 * modern folktale written for that feeling, a lesson drawn gently from
 * it, and one reflection question. Every result is labelled as
 * generated, because it is, and it is never placed in the library: the
 * House's stories are written by people; this is a companion's answer
 * to one person on one evening.
 *
 * The safety screen runs on the feeling before this is called. The
 * caller gates it to Premium and rate-limits it; this file only writes.
 */

export type SoulStory = {
  title: string;
  story: string;
  lesson: string;
  question: string;
};

export type SoulResult = { ok: true; result: SoulStory } | { ok: false; error: string };

const SYSTEM = `You are the Librarian of Soulfables, a house of modern folktales about love, loss, healing, identity, hope and becoming.
A reader will tell you how they feel. Write them one short modern folktale for that feeling.

The story: 250 to 400 words. Third person. One character, one concrete image, one turn. Plain, unhurried sentences. No moral stated inside the story. No exclamation marks. Never cheerful in the face of pain. Do not name the feeling the reader gave you; let the story hold it.
The lesson: two or three sentences, gentle, drawn from the story. It notices; it does not advise. No "you should".
The question: one reflection question, open, that the reader could write to for ten minutes. If one of the House's own questions fits well, use it word for word; otherwise write one in the same register.

You are not a therapist. Do not diagnose, do not give clinical or medical advice, do not tell the reader what to do about their life.

Answer in exactly this shape and nothing else:
# Title
<a title of two to five words>
# Story
<the story>
# Lesson
<the lesson>
# Question
<the question>`;

function section(text: string, name: string): string {
  const re = new RegExp(`#\\s*${name}\\s*\\n([\\s\\S]*?)(?=\\n#\\s*[A-Z]|$)`, 'i');
  const m = text.match(re);
  return (m?.[1] ?? '').trim();
}

export async function storyForFeeling(feeling: string): Promise<SoulResult> {
  const cards = await getCards();
  const questions = cards.map((c) => `- ${c.body}`).join('\n');

  const result = await ask({
    system: `${SYSTEM}\n\nThe House's own questions, should one fit:\n${questions}`,
    prompt: `I'm feeling: ${feeling.trim().slice(0, 300)}`,
    job: 'soul-story',
    maxTokens: 1200,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const title = section(result.text, 'Title').split('\n')[0]?.trim() ?? '';
  const story = section(result.text, 'Story');
  const lesson = section(result.text, 'Lesson');
  const question = section(result.text, 'Question');

  if (!story || !question) {
    return { ok: false, error: 'The story did not arrive whole. Try once more.' };
  }
  return { ok: true, result: { title: title || 'A story for tonight', story, lesson, question } };
}

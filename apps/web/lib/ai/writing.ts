import 'server-only';
import { ask, claudeConfigured } from './claude';
import { getStories, getShelves } from '../content';
import { getStory } from '../content';

/**
 * The writing assistant.
 *
 * Three jobs, all producing a DRAFT: start something from a brief,
 * continue from where the writing stopped, and suggest the small
 * surrounding text — title, subtitle, excerpt.
 *
 * None of them publish, and none of them save on their own. What comes
 * back lands in the editor for a person to read, change and keep or
 * discard. That is not timidity about the model; it is that a House
 * whose stories nobody read before they went out would stop being worth
 * reading.
 *
 * The distinction from the Librarian matters and is kept in code as well
 * as in prose: the companion talks to a reader who may be in a bad way
 * and carries hard non-clinical rails. This talks to staff about drafts.
 * Same provider, different prompt, different posture.
 */

export type Job = 'draft' | 'continue' | 'titles';

export type WritingResult = { ok: true; text: string } | { ok: false; error: string };

export function writingAvailable(): boolean {
  return claudeConfigured();
}

/**
 * The House's voice, assembled from the House rather than described.
 *
 * A style guide written in adjectives ("warm, literary, unhurried")
 * produces prose that reads like adjectives. Real openings from real
 * stories are what actually transfers a register — so the model is shown
 * three, and told to match them.
 */
async function houseVoice(shelfSlug?: string): Promise<string> {
  const [stories, shelves] = await Promise.all([getStories(), getShelves()]);

  const shelf = shelfSlug ? shelves.find((s) => s.slug === shelfSlug) : null;

  // Prefer examples from the same shelf: a grief story and a hope story
  // are not written in the same key.
  const onShelf = shelfSlug ? stories.filter((s) => s.shelf === shelfSlug) : [];
  const chosen = [...onShelf, ...stories].slice(0, 3);

  const samples = await Promise.all(
    chosen.map(async (card) => {
      const full = await getStory(card.slug);
      const opening = full?.body?.trim().split(/\n\s*\n/).slice(0, 2).join('\n\n') ?? '';
      return opening ? `— "${card.title}"\n\n${opening}` : null;
    }),
  );

  const examples = samples.filter(Boolean).join('\n\n');

  return [
    'You are helping write for Soulfables, a house of modern folktales about love, loss, healing, identity, hope and becoming.',
    '',
    'The voice, which you must match rather than describe:',
    '- Unhurried. Short sentences carry the weight; long ones earn their length.',
    '- Concrete before abstract. A kettle boiled for two, not "the pain of absence".',
    '- Second person or close third. The reader is being spoken to, not lectured.',
    '- No therapy language. Never "healing journey", "closure", "self-care", "trauma".',
    '- No moral at the end. The story stops; it does not explain itself.',
    '- British spelling.',
    '',
    shelf
      ? `This story sits on the ${shelf.label} shelf — ${shelf.tagline}${
          shelf.librarianNote ? ` The Librarian says of it: "${shelf.librarianNote}"` : ''
        }`
      : '',
    '',
    examples ? `Openings from the House, to match:\n\n${examples}` : '',
    '',
    'Write prose only. No preamble, no notes about what you have written, no headings unless the format asks for them.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function draftStory(opts: {
  brief: string;
  shelfSlug?: string;
  title?: string;
  storySlug?: string;
}): Promise<WritingResult> {
  if (!writingAvailable()) {
    return { ok: false, error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const system = await houseVoice(opts.shelfSlug);

  const result = await ask({
    system,
    job: 'draft',
    storySlug: opts.storySlug,
    maxTokens: 3000,
    prompt: [
      opts.title ? `Working title: ${opts.title}` : '',
      `Write a complete short story, roughly 900 to 1,400 words, from this brief:`,
      '',
      opts.brief,
      '',
      'Use "::" on its own line before a section heading if the story wants sections. Otherwise write it straight through.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return result.ok ? { ok: true, text: result.text } : { ok: false, error: result.error };
}

export async function continueWriting(opts: {
  existing: string;
  shelfSlug?: string;
  note?: string;
  storySlug?: string;
}): Promise<WritingResult> {
  if (!writingAvailable()) {
    return { ok: false, error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const system = await houseVoice(opts.shelfSlug);

  /*
   * The tail, not the whole thing. Continuing needs the last few hundred
   * words to match rhythm and remember where the scene is; sending the
   * entire story costs tokens to tell the model things it will not use.
   */
  const tail = opts.existing.trim().split(/\s+/).slice(-600).join(' ');

  const result = await ask({
    system,
    job: 'continue',
    storySlug: opts.storySlug,
    maxTokens: 1500,
    prompt: [
      'Here is where the writing stopped. Continue it — do not summarise, do not restate, do not start again. Pick up mid-breath and carry on.',
      opts.note ? `\nThe writer says: ${opts.note}` : '',
      '',
      '---',
      tail,
      '---',
      '',
      'Write the next 300 to 600 words.',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return result.ok ? { ok: true, text: result.text } : { ok: false, error: result.error };
}

export async function suggestTitles(opts: {
  body: string;
  shelfSlug?: string;
  storySlug?: string;
}): Promise<WritingResult> {
  if (!writingAvailable()) {
    return { ok: false, error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const system = await houseVoice(opts.shelfSlug);
  const opening = opts.body.trim().split(/\s+/).slice(0, 800).join(' ');

  const result = await ask({
    system,
    job: 'titles',
    storySlug: opts.storySlug,
    maxTokens: 700,
    // Lower, because this is a shape rather than prose. A creative
    // temperature here produces five titles and one list of adjectives.
    temperature: 0.7,
    prompt: [
      'Read this story and suggest what surrounds it.',
      '',
      '---',
      opening,
      '---',
      '',
      'Reply in exactly this format, nothing else:',
      '',
      'TITLES',
      '1. …',
      '2. …',
      '3. …',
      '',
      'SUBTITLE',
      'One line, under fifteen words, in the House register.',
      '',
      'EXCERPT',
      'Two sentences a reader would see on a card before opening it.',
    ].join('\n'),
  });

  return result.ok ? { ok: true, text: result.text } : { ok: false, error: result.error };
}

import 'server-only';
import { ask, claudeConfigured, type Turn } from './claude';
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

export type Job = 'draft' | 'continue' | 'titles' | 'concepts' | 'ask';

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

/**
 * A concept: what a story could be, before a word of it exists.
 *
 * Three of these come back for one description, on purpose. One answer
 * reads as the answer; three read as what they are — ways in, for the
 * writer to pick from, cross, or reject entirely.
 */
export type Concept = {
  title: string;
  subtitle: string;
  /** A real shelf slug, or '' if the model named one that does not exist. */
  shelf: string;
  premise: string;
  shape: 'full' | 'serial';
  /** Section titles for a whole story; chapter titles for a serial. */
  sections: string[];
  opening: string;
  /** What this version is for — one line. */
  why: string;
};

export type ConceptResult =
  | { ok: true; concepts: Concept[] }
  | { ok: false; error: string };

/**
 * From a title and a description, propose what the story could be.
 *
 * This runs as the writer finishes describing the idea — the moment the
 * House can be most useful and least in the way, before there is prose
 * to be precious about. It asks for JSON and reads it back leniently: a
 * model that wraps the array in a code fence has still answered.
 */
export async function proposeConcepts(opts: {
  title: string;
  description: string;
  shelfSlug?: string;
}): Promise<ConceptResult> {
  if (!writingAvailable()) {
    return { ok: false, error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const shelves = await getShelves();
  const known = new Set(shelves.map((s) => s.slug));
  const shelfList = shelves.map((s) => `${s.slug} (${s.label} — ${s.tagline})`).join('\n');
  const system = await houseVoice(opts.shelfSlug);

  const result = await ask({
    system,
    job: 'concepts',
    maxTokens: 2500,
    prompt: [
      `A writer has a title and a description, and not yet a story. Propose three different concepts for it — three ways this could go, not three phrasings of one.`,
      '',
      `Title: ${opts.title}`,
      opts.shelfSlug ? `Shelf the writer chose: ${opts.shelfSlug}` : 'Shelf: choose the one that fits each concept.',
      '',
      'Description:',
      opts.description,
      '',
      'The shelves that exist (use the slug exactly):',
      shelfList,
      '',
      'Reply with JSON only — an array of exactly three objects, nothing before or after it:',
      '[{"title": "a title (the writer\'s, or a better one)", "subtitle": "one line under fifteen words", "shelf": "a slug from the list", "premise": "two or three sentences of what happens and what it costs", "shape": "full or serial", "sections": ["three to five section titles, or chapter titles for a serial"], "opening": "the first sentence or two, in the House voice", "why": "one sentence on what this version is for"}]',
    ].join('\n'),
  });

  if (!result.ok) return { ok: false, error: result.error };

  const parsed = readConcepts(result.text, known);
  if (parsed.length === 0) {
    return { ok: false, error: 'The model answered, but not in a shape that could be read. Try once more.' };
  }
  return { ok: true, concepts: parsed };
}

function readConcepts(text: string, known: Set<string>): Concept[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  return raw
    .map((c): Concept | null => {
      if (!c || typeof c !== 'object') return null;
      const o = c as Record<string, unknown>;
      const title = str(o.title, 200);
      const premise = str(o.premise, 1200);
      if (!title || !premise) return null;
      const shelf = str(o.shelf, 60).toLowerCase();
      return {
        title,
        subtitle: str(o.subtitle, 200),
        shelf: known.has(shelf) ? shelf : '',
        premise,
        shape: str(o.shape, 10).toLowerCase() === 'serial' ? 'serial' : 'full',
        sections: Array.isArray(o.sections)
          ? o.sections.map((x) => str(x, 120)).filter(Boolean).slice(0, 8)
          : [],
        opening: str(o.opening, 1000),
        why: str(o.why, 300),
      };
    })
    .filter((c): c is Concept => c !== null)
    .slice(0, 3);
}

/**
 * Ask AI: a conversation with the writing assistant.
 *
 * Same voice and same rails as the draft jobs, but talking rather than
 * producing. It knows which story is open, if one is, so "is this
 * opening working?" can be answered from the words rather than in
 * general. It still saves nothing: what it says goes into a chat panel,
 * and the story changes only when the writer changes it.
 */
export async function askWriter(opts: {
  messages: Turn[];
  story?: {
    slug: string;
    title: string;
    subtitle?: string;
    shelfSlug?: string;
    body?: string;
  } | null;
}): Promise<WritingResult> {
  if (!writingAvailable()) {
    return { ok: false, error: 'No AI provider is connected. Settings → Billing shows what is missing.' };
  }

  const voice = await houseVoice(opts.story?.shelfSlug);

  /* The tail of the story, if there is one: enough to answer "how is
     this going" from the page, not so much that every turn re-reads it. */
  const tail = opts.story?.body?.trim().split(/\s+/).slice(-800).join(' ') ?? '';

  const system = [
    voice,
    '',
    'Right now you are in conversation with one of the House\'s writers, in the Writing Room. Answer what they ask, plainly and briefly — a few short paragraphs at most. Offer choices rather than verdicts. When they ask for prose, write it in the House voice; when they ask a question, answer the question. Do not pad, do not praise, do not summarise what they said back to them.',
    opts.story
      ? [
          '',
          `The story open on the desk is "${opts.story.title}"${opts.story.subtitle ? ` — ${opts.story.subtitle}` : ''}${opts.story.shelfSlug ? ` (${opts.story.shelfSlug} shelf)` : ''}.`,
          tail ? `Where it has got to, most recently:\n\n---\n${tail}\n---` : 'Nothing has been written for it yet.',
        ].join('\n')
      : '\nNo story is open; they are at their desk with the whole room in front of them.',
  ].join('\n');

  /* The last dozen turns. A conversation about a draft rarely needs its
     own history further back than that, and every turn resent is paid
     for again. */
  const messages = opts.messages.slice(-12);

  const result = await ask({
    system,
    messages,
    job: 'ask',
    storySlug: opts.story?.slug,
    maxTokens: 1200,
  });

  return result.ok ? { ok: true, text: result.text } : { ok: false, error: result.error };
}

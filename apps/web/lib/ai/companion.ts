import 'server-only';
import { getStories, getShelves } from '../content';
import { getCards } from '../questions';
import { getPromptPool } from '../journal';
import { getAffirmations } from '../affirmations';
import { isDemoMode } from '../demo/mode';

/**
 * The Soulfables companion.
 *
 * Brief §13: a reflection and storytelling companion, explicitly not a
 * therapist. Three things enforce that here rather than merely stating it:
 *
 *   1. `SYSTEM_PROMPT` forbids diagnosis and advice, and is the only
 *      place the companion's character is defined.
 *   2. `screenForDistress()` runs on the reader's message BEFORE any
 *      model sees it. A flagged turn returns crisis resources and never
 *      reaches a provider — a safety rule implemented in a prompt is a
 *      request; implemented here it is a guarantee.
 *   3. Journal entries are never included in context unless the reader
 *      opted that entry in. See lib/demo/queries and the ai_opt_in column.
 *
 * The provider is behind `CompanionProvider` so switching models is one
 * file, as §13 requires. The demo ships a deterministic provider that
 * needs no API key and no network.
 */

export type CompanionMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Set when the safety layer intervened. */
  safety?: 'crisis' | null;
  /** Stories the companion pointed at, for rendering as real links. */
  suggestions?: { slug: string; title: string }[];
  /** True when a model wrote this reply rather than the House's rules. */
  generated?: boolean;
};

/** What the Librarian knows when it answers. */
export type CompanionContext = {
  stories: { slug: string; title: string; subtitle: string; shelf: string }[];
  shelves: { slug: string; label: string }[];
  /** The drawer of quiet questions, by body. */
  questions: string[];
  /** The journal's daily prompts, by body. */
  prompts: string[];
  /** Calm lines the House says. */
  affirmations: string[];
};

export const SYSTEM_PROMPT = `You are the Librarian of Soulfables, a house of modern folktales about love, loss, healing, identity and becoming.

You help readers reflect on stories, explore what a story stirred up, and find their way to the next one.

You are not a therapist and never behave as one. You do not diagnose, do not give clinical or medical advice, and do not tell people what they should do about their lives. You ask, you notice, and you point at stories.

Your voice is quiet, warm and unhurried. Short paragraphs. No exclamation marks. Never cheerful in the face of something painful.

When a reader describes a feeling, you may name a shelf or a story that meets it, and say why. Only ever recommend stories from the list of real Soulfables stories you are given.`;

/**
 * Phrases that mean a conversation has stopped being about a story.
 *
 * Deliberately broad and deliberately not clever. A false positive costs
 * a reader one message that offers help they did not need; a false
 * negative costs something that cannot be undone. The asymmetry decides
 * the threshold.
 */
const DISTRESS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm)(ing)?\s+(myself|me)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend (my|it all|my life)\b/i,
  /\bdon'?t want to (be here|live|wake up)\b/i,
  /\bno reason to (live|go on|carry on)\b/i,
  /\b(want|going) to die\b/i,
  /\bself[- ]harm\b/i,
  /\bcut(ting)? myself\b/i,
];

export function screenForDistress(text: string): boolean {
  return DISTRESS_PATTERNS.some((re) => re.test(text));
}

export const CRISIS_RESPONSE = `I want to stop and say something plainly, because it matters more than any story.

What you have written sounds like more than a hard evening, and I am a companion for reflection — not someone who can help with this. Please talk to a person who can.

**Find a Helpline** lists free, confidential support lines in over 130 countries: https://findahelpline.com

If you are in immediate danger, please contact your local emergency number.

I will still be here afterwards, and so will the library. But not instead of this.`;

export interface CompanionProvider {
  readonly name: string;
  reply(
    history: CompanionMessage[],
    context: CompanionContext,
  ): Promise<CompanionMessage>;
}

/**
 * Demo provider.
 *
 * Deterministic, offline, and honest about what it is. It does real work
 * — it reads the message, matches it against the actual library, and
 * suggests real stories with real reasons — so the shape of the feature
 * is testable. It is not a language model and does not pretend to be.
 */
class DemoCompanion implements CompanionProvider {
  readonly name = 'demo';

  async reply(
    history: CompanionMessage[],
    context: CompanionContext,
  ): Promise<CompanionMessage> {
    const last = [...history].reverse().find((m) => m.role === 'user');
    const text = (last?.content ?? '').toLowerCase();

    // Feeling → shelf, using the House's own vocabulary.
    const feelings: { match: RegExp; shelf: string; opening: string }[] = [
      { match: /heartbreak|broke up|breakup|left me|dumped|ex\b/, shelf: 'heartbreak', opening: 'Heartbreak is its own country, and it has its own shelf here.' },
      { match: /grief|died|death|lost (my|him|her|them)|funeral|passed away/, shelf: 'grief', opening: 'Grief does not move in a straight line, and the House does not ask it to.' },
      { match: /heal|better|recover|mending|moving on/, shelf: 'healing', opening: 'Healing rarely announces itself. Mostly it is quiet, and slower than anyone wants.' },
      { match: /lonely|alone|isolat|nobody|no one/, shelf: 'loneliness', opening: 'There is a shelf for the hours that have no company.' },
      { match: /can'?t sleep|awake|insomnia|3am|sleepless|night/, shelf: 'anxiety', opening: 'For the nights the mind will not put itself down.' },
      { match: /hope|future|better days|looking forward/, shelf: 'hope', opening: 'Hope is usually early, and usually quieter than people expect.' },
      { match: /forgive|apolog|resent|angry at/, shelf: 'forgiveness', opening: 'Including the hardest one, which is usually yourself.' },
      { match: /chang|start over|new job|moved|beginning|leaving/, shelf: 'change', opening: 'Beginning again costs something. It also gives something back.' },
      { match: /love|in love|marriage|partner/, shelf: 'love', opening: 'Love arrives in more shapes than anyone plans for.' },
    ];

    const found = feelings.find((f) => f.match.test(text));

    if (found) {
      const matches = context.stories
        .filter((s) => s.shelf === found.shelf)
        .slice(0, 2);

      if (matches.length > 0) {
        return {
          role: 'assistant',
          content: `${found.opening}\n\nIf you want somewhere to start, ${matches
            .map((m) => `**${m.title}** — ${m.subtitle.toLowerCase().replace(/\.$/, '')}`)
            .join(', and ')}.\n\nYou do not have to read anything. Sometimes it is enough to know the shelf is there.`,
          suggestions: matches.map((m) => ({ slug: m.slug, title: m.title })),
        };
      }
    }

    // Asking for a story without naming a feeling.
    if (/recommend|suggest|what should i read|something to read/.test(text)) {
      const picks = context.stories.slice(0, 2);
      return {
        role: 'assistant',
        content: `I would rather ask first: what kind of evening is it?\n\nIf you would like me to simply choose — **${picks[0]?.title}** is where most people begin, and **${picks[1]?.title}** if you have a little longer.`,
        suggestions: picks.map((p) => ({ slug: p.slug, title: p.title })),
      };
    }

    // Reflection prompts.
    if (/prompt|journal|write|reflect/.test(text)) {
      return {
        role: 'assistant',
        content: `Here is one, if it is useful:\n\n*What are you carrying that was never yours to hold?*\n\nWrite badly. Nobody reads the journal but you — not even us.`,
      };
    }

    return {
      role: 'assistant',
      content: `Tell me how the evening is going, and I will find you something.\n\nYou can say a feeling — heartbroken, sleepless, hopeful — or describe it however it actually is. I will listen for the shelf.`,
    };
  }
}

/**
 * A model behind the Librarian, for Premium.
 *
 * Same system prompt, same safety screen in front of it, same library
 * to point at — plus the drawer of questions, the daily prompts and the
 * affirmations, so it can offer one of the four things the House offers.
 * It may only quote what it is given; a story it invents would be a
 * story the House does not have.
 */
class ModelCompanion implements CompanionProvider {
  readonly name = 'model';

  async reply(history: CompanionMessage[], context: CompanionContext): Promise<CompanionMessage> {
    const { ask } = await import('./claude');
    const system = [
      SYSTEM_PROMPT,
      '',
      'When it fits — and never in every reply — you may offer exactly one of these four things: a story from the library below, by its exact title; a reflection question from the questions below, word for word; a journaling prompt from the prompts below, word for word; or an affirmation from the affirmations below, word for word. Say which of the four it is. Do not invent stories, questions, prompts or affirmations.',
      'Keep each reply under 160 words. Ask at most one question back. Short paragraphs.',
      '',
      'The library (title — subtitle — shelf):',
      ...context.stories.map((s) => `- ${s.title} — ${s.subtitle} — ${s.shelf}`),
      '',
      'Shelves: ' + context.shelves.map((s) => s.label).join(', '),
      '',
      'Reflection questions:',
      ...context.questions.map((q) => `- ${q}`),
      '',
      'Journaling prompts:',
      ...context.prompts.map((q) => `- ${q}`),
      '',
      'Affirmations:',
      ...context.affirmations.map((a) => `- ${a}`),
    ].join('\n');

    const turns = history
      .filter((m) => !m.safety)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await ask({ system, messages: turns, job: 'companion', maxTokens: 500 });
    if (!result.ok) {
      return {
        role: 'assistant',
        content: 'I lost the thread for a moment. Say that again, and I will listen properly.',
      };
    }

    // A recommendation you cannot click is one you have to retype: any
    // story named in the reply becomes a real link.
    const text = result.text.trim();
    const suggestions = context.stories
      .filter((s) => text.includes(s.title))
      .slice(0, 3)
      .map((s) => ({ slug: s.slug, title: s.title }));

    return { role: 'assistant', content: text, suggestions, generated: true };
  }
}

/**
 * Which Librarian answers.
 *
 * The rule-based one for everybody by default: it talks to people who
 * may be in a bad way, and its replies are a known set. The model
 * answers only for Premium readers and staff, only when a key is
 * configured, and always behind the same safety screen.
 */
export async function getCompanionProvider(opts: { premium: boolean } = { premium: false }): Promise<CompanionProvider> {
  if (!opts.premium || isDemoMode()) return new DemoCompanion();
  const { claudeConfigured } = await import('./claude');
  if (!claudeConfigured()) return new DemoCompanion();
  return new ModelCompanion();
}

/** The library, shaped for the companion's context window. */
export async function buildContext(opts: { premium: boolean } = { premium: false }): Promise<CompanionContext> {
  const [stories, shelves, cards, prompts, affirmations] = await Promise.all([
    getStories(),
    getShelves(),
    getCards(),
    getPromptPool(),
    getAffirmations(),
  ]);
  return {
    // A free reader is only ever pointed at what they can open.
    stories: stories
      .filter((s) => opts.premium || s.access === 'free')
      .map((s) => ({ slug: s.slug, title: s.title, subtitle: s.subtitle, shelf: s.shelf })),
    shelves: shelves.map((s) => ({ slug: s.slug, label: s.label })),
    questions: cards.map((c) => c.body),
    prompts,
    affirmations: affirmations.map((a) => a.body),
  };
}

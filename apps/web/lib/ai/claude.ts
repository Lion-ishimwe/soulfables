import 'server-only';
import { recordUsage, type FailureKind } from './record';

/**
 * Claude, behind the adapter.
 *
 * Called over fetch rather than through the SDK: this needs one endpoint
 * with four fields, and a dependency that has to be kept current for the
 * rest of the project's life is a poor trade for the ceremony it saves.
 *
 * Everything provider-specific is in this file. The writing assistant
 * and the companion both go through ask(), so swapping to another model
 * is one implementation rather than a search through the codebase — which
 * is the whole reason the seam was there before anything filled it.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages';

/*
 * Pinned in the environment, defaulted here.
 *
 * Sonnet drafts prose well and costs a fraction of Opus, which matters
 * when a single "continue this chapter" call carries several thousand
 * tokens of the House's existing voice as context. Set AI_MODEL to reach
 * for something stronger on the hard jobs.
 */
const DEFAULT_MODEL = 'claude-sonnet-5';

export type AskOptions = {
  system: string;
  prompt: string;
  /** Hard ceiling on the reply. Prose jobs need room; titles do not. */
  maxTokens?: number;
  /** Lower for structure, higher for prose. */
  temperature?: number;
  /*
   * What this call is for, and what it is for. Both are only used to
   * attribute the spend on the Billing page — the model never sees
   * them — but without them the meter can say what the House spent and
   * not what it spent it on, which is the only thing the provider's own
   * console already tells us.
   */
  job?: string;
  storySlug?: string;
};

export type AskResult =
  | { ok: true; text: string; inputTokens: number; outputTokens: number }
  | { ok: false; error: string };

export function claudeConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY) && (process.env.AI_PROVIDER ?? 'anthropic') === 'anthropic';
}

export async function ask(options: AskOptions): Promise<AskResult> {
  const model = process.env.AI_MODEL || DEFAULT_MODEL;
  const job = options.job ?? 'unknown';
  const started = Date.now();

  /* Every exit from this function goes through one of these two, so no
     call can be made without the meter turning. */
  const fail = async (
    error: string,
    failureKind: FailureKind,
  ): Promise<AskResult> => {
    await recordUsage({
      job, model, ok: false, error, failureKind,
      durationMs: Date.now() - started,
      storySlug: options.storySlug,
    });
    return { ok: false, error };
  };

  const key = process.env.AI_API_KEY;
  if (!key) {
    // Not recorded: nothing was attempted and nothing was spent. A row
    // here would put "no key configured" in a table of model calls.
    return {
      ok: false,
      error: 'No AI key is configured. Settings → Billing shows what is missing.',
    };
  }

  /*
   * A timeout, because a server action that never returns is a page that
   * never finishes loading. Sixty seconds is generous for a chapter and
   * short enough that a hung request fails as a message rather than as a
   * spinner nobody can explain.
   */
  const abort = AbortSignal.timeout(60_000);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: abort,
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 1,
        system: options.system,
        messages: [{ role: 'user', content: options.prompt }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      let message = `The model refused (${response.status}).`;

      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        /* not JSON; the status line is what we have */
      }

      /*
       * The failures worth naming, because each has a different fix and
       * "the model refused" sends somebody to the wrong one.
       *
       * Running out of credit is the one that matters most and the one
       * the status code hides: it arrives as a 400, indistinguishable
       * from a malformed request until you read the prose. The Billing
       * page exists largely to catch this, so it is matched explicitly
       * rather than swept into "bad request".
       */
      let kind: FailureKind = 'refused';

      if (/credit balance is too low|insufficient.*credit|billing/i.test(message)) {
        kind = 'credit';
        message =
          'The Anthropic account has run out of credit. Settings → Billing has the link to top it up.';
      } else if (response.status === 401 || response.status === 403) {
        kind = 'auth';
        message = 'The AI key was rejected. Check AI_API_KEY in Settings → Billing.';
      } else if (response.status === 429) {
        kind = 'rate_limit';
        message = 'Rate limited by the model. Wait a moment and try again.';
      } else if (response.status === 529 || response.status >= 500) {
        kind = 'overloaded';
        message = 'The model is overloaded. This usually clears in a minute.';
      }

      return fail(message, kind);
    }

    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')
      .trim();

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    if (!text) {
      // Billable: the tokens were spent whether or not they said
      // anything, so this is recorded as a failure that still cost.
      await recordUsage({
        job, model, inputTokens, outputTokens,
        ok: false,
        error: 'The model returned nothing.',
        failureKind: 'refused',
        durationMs: Date.now() - started,
        storySlug: options.storySlug,
      });
      return { ok: false, error: 'The model returned nothing.' };
    }

    await recordUsage({
      job, model, inputTokens, outputTokens,
      ok: true,
      durationMs: Date.now() - started,
      storySlug: options.storySlug,
    });

    return { ok: true, text, inputTokens, outputTokens };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return fail('The model took too long. Try a shorter brief.', 'timeout');
    }
    return fail('Could not reach the model.', 'unreachable');
  }
}

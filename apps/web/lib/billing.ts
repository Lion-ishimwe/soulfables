import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';
import { rateFor } from './ai/pricing';

/**
 * What the writing assistant costs, and whether it works.
 *
 * Two different questions, answered from two different places.
 *
 * The spending comes from ai_usage, which the House writes itself. That
 * is why it can be broken down by story and by feature: Anthropic's
 * console has the authoritative total and has never heard of a story.
 *
 * The key's health comes from asking Anthropic. The check is deliberately
 * the models endpoint rather than a real completion — it authenticates
 * the key and costs nothing, so opening this page never spends money.
 * What it cannot tell us is whether there is credit left, because listing
 * models works perfectly well at a zero balance. That answer only exists
 * in the failures ai_usage has recorded, which is the other half of why
 * this table stores them.
 */

export type SpendReport = {
  live: boolean;
  since: string | null;
  totals: { calls: number; failed: number; inputTokens: number; outputTokens: number; costMicros: number };
  lifetime: { calls: number; costMicros: number; firstCall: string | null };
  byJob: { job: string; calls: number; costMicros: number; outputTokens: number }[];
  byStory: { slug: string; title: string; calls: number; costMicros: number }[];
  byAuthor: { email: string; calls: number; costMicros: number }[];
  byDay: { day: string; costMicros: number }[];
  lastFailure: { at: string; kind: string | null; error: string | null; job: string } | null;
  lastSuccess: { at: string; model: string } | null;
};

const EMPTY: SpendReport = {
  live: false,
  since: null,
  totals: { calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costMicros: 0 },
  lifetime: { calls: 0, costMicros: 0, firstCall: null },
  byJob: [], byStory: [], byAuthor: [], byDay: [],
  lastFailure: null, lastSuccess: null,
};

export async function getSpendReport(days = 30): Promise<SpendReport> {
  if (isDemoMode()) return EMPTY;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('ai_spend_report', { p_days: days });

  if (error || !data) {
    if (error) console.error('[billing] ai_spend_report', error.message);
    return EMPTY;
  }

  const d = data as Record<string, Record<string, unknown>>;
  const n = (v: unknown) => Number(v ?? 0);

  return {
    live: true,
    since: (d.since as unknown as string) ?? null,
    totals: {
      calls: n(d.totals?.calls),
      failed: n(d.totals?.failed),
      inputTokens: n(d.totals?.input_tokens),
      outputTokens: n(d.totals?.output_tokens),
      costMicros: n(d.totals?.cost_micros),
    },
    lifetime: {
      calls: n(d.lifetime?.calls),
      costMicros: n(d.lifetime?.cost_micros),
      firstCall: (d.lifetime?.first_call as string) ?? null,
    },
    byJob: ((d.by_job ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      job: String(r.job ?? 'unknown'),
      calls: n(r.calls),
      costMicros: n(r.cost_micros),
      outputTokens: n(r.output_tokens),
    })),
    byStory: ((d.by_story ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      slug: String(r.slug), title: String(r.title),
      calls: n(r.calls), costMicros: n(r.cost_micros),
    })),
    byAuthor: ((d.by_author ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      email: String(r.email), calls: n(r.calls), costMicros: n(r.cost_micros),
    })),
    byDay: ((d.by_day ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      day: String(r.day), costMicros: n(r.cost_micros),
    })),
    lastFailure: (d.last_failure as never) ?? null,
    lastSuccess: (d.last_success as never) ?? null,
  };
}

// ---------------------------------------------------------------------
// Is the key working?
// ---------------------------------------------------------------------

export type KeyHealth = {
  state: 'missing' | 'working' | 'rejected' | 'no_credit' | 'unreachable';
  headline: string;
  detail: string;
  model: string;
  /** Rate the estimate is priced at, and whether we know it. */
  rate: { input: number; output: number; known: boolean };
  /** Where the key ends, so it can be told apart without being shown. */
  keyTail: string | null;
};

export async function getKeyHealth(report: SpendReport): Promise<KeyHealth> {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'claude-sonnet-5';
  const rate = rateFor(model);
  const keyTail = key ? `…${key.slice(-6)}` : null;

  if (!key) {
    return {
      state: 'missing', model, rate, keyTail,
      headline: 'No key connected',
      detail:
        'AI_API_KEY is not set, so the writing assistant is switched off. On the server it comes from Parameter Store; locally, from .env.local.',
    };
  }

  /*
   * The recorded failure is checked before the network, and only when it
   * is the most recent thing that happened. A key can authenticate
   * perfectly and still be out of money — that is invisible here and
   * visible only in what the assistant did last.
   */
  const failedLast =
    report.lastFailure &&
    (!report.lastSuccess ||
      new Date(report.lastFailure.at) > new Date(report.lastSuccess.at));

  if (failedLast && report.lastFailure?.kind === 'credit') {
    return {
      state: 'no_credit', model, rate, keyTail,
      headline: 'Out of credit',
      detail:
        'The key is valid but the Anthropic account has no balance left. Top it up and the assistant starts working again — nothing here needs changing.',
    };
  }

  // Free, and does not generate a single token.
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return {
        state: 'rejected', model, rate, keyTail,
        headline: 'Key rejected',
        detail:
          'Anthropic did not accept this key. It may have been revoked or rotated. Replace it in Parameter Store, then deploy.',
      };
    }

    if (!res.ok) {
      return {
        state: 'unreachable', model, rate, keyTail,
        headline: `Anthropic answered ${res.status}`,
        detail: 'The key could not be checked just now. This is usually temporary.',
      };
    }

    if (failedLast) {
      const kind = report.lastFailure?.kind;
      return {
        state: 'working', model, rate, keyTail,
        headline: 'Connected, but the last call failed',
        detail:
          kind === 'rate_limit'
            ? 'The key works. The last request was rate limited, which clears on its own.'
            : kind === 'overloaded'
              ? 'The key works. The model was overloaded, which usually clears within a minute.'
              : `The key works. The last request failed: ${report.lastFailure?.error ?? 'no reason recorded'}`,
      };
    }

    return {
      state: 'working', model, rate, keyTail,
      headline: 'Connected',
      detail: report.lastSuccess
        ? `Last used successfully on ${new Date(report.lastSuccess.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
        : 'The key authenticates. Nothing has been written with it yet.',
    };
  } catch {
    return {
      state: 'unreachable', model, rate, keyTail,
      headline: 'Could not reach Anthropic',
      detail: 'The key could not be checked. The network may be blocked, or the service may be down.',
    };
  }
}

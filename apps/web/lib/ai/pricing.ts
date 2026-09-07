import 'server-only';

/**
 * What a call costs, in USD millionths.
 *
 * These are Anthropic's published first-party rates, per million tokens.
 * They are used to estimate — the console is authoritative for what is
 * actually owed, and this will differ from it wherever caching, batch
 * discounts or a rate change apply.
 *
 * Saying so matters more than the arithmetic: a page that shows a number
 * next to the word "billing" will be believed, so it has to be clear
 * that this is the House's own measurement and not an invoice.
 *
 * Rates checked against the API documentation, June 2026.
 */

type Rate = { input: number; output: number };

/** USD per million tokens. */
const RATES: Record<string, Rate> = {
  'claude-fable-5-1': { input: 10, output: 50 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/*
 * What an unknown model is priced at.
 *
 * Zero would be worse than wrong: a new model would quietly cost nothing
 * and the total would understate itself with no sign that anything was
 * missing. Opus rates are the safe direction to be wrong in — an
 * estimate that is too high prompts somebody to look, and one that is
 * too low does not.
 */
const FALLBACK: Rate = { input: 5, output: 25 };

export function isPricedModel(model: string): boolean {
  return model in RATES;
}

/** Cost of one call, in USD millionths. Integer — see the table's comment. */
export function costMicros(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rate = RATES[model] ?? FALLBACK;

  // per-million-tokens × tokens ÷ 1e6, expressed in micros (×1e6),
  // which cancels to rate × tokens. Rounded once, at the end.
  return Math.round(rate.input * inputTokens + rate.output * outputTokens);
}

/** "$1.24", "$0.0037", "—". Small sums keep their digits. */
export function formatMicros(micros: number): string {
  const dollars = micros / 1_000_000;
  if (micros === 0) return '$0.00';
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

export function rateFor(model: string): Rate & { known: boolean } {
  return { ...(RATES[model] ?? FALLBACK), known: model in RATES };
}

import 'server-only';
import { createClient } from '../supabase/server';
import { isDemoMode } from '../demo/mode';
import { costMicros } from './pricing';

/**
 * Writing down what a model call cost.
 *
 * Fire and forget, on the same reasoning as track() in lib/analytics: a
 * writer must never lose a draft because the meter could not be written.
 * A swallowed failure here costs one row of accounting; a thrown one
 * costs somebody their paragraph.
 *
 * Failures are recorded too, and are the more useful half. "Your credit
 * balance is too low" is the moment the assistant stopped working, and
 * without a row for it the only trace is a red sentence inside a form
 * that whoever hit it has already navigated away from.
 */

export type FailureKind =
  | 'auth'
  | 'credit'
  | 'rate_limit'
  | 'overloaded'
  | 'timeout'
  | 'unreachable'
  | 'refused';

export type UsageRecord = {
  job: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  ok: boolean;
  error?: string;
  failureKind?: FailureKind;
  durationMs?: number;
  /** Attributes the spend to a story. Resolved from the slug. */
  storySlug?: string;
};

export async function recordUsage(entry: UsageRecord): Promise<void> {
  if (isDemoMode()) return;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    /*
     * The story id, looked up from the slug.
     *
     * A second round trip for a foreign key looks wasteful, and would be
     * if this were on the reader's path — it is not. It runs after a
     * model call that took several seconds, so the cost is invisible,
     * and storing the id rather than the slug means the report survives
     * a story being renamed.
     */
    let storyId: string | null = null;
    if (entry.storySlug) {
      const { data } = await supabase
        .from('stories')
        .select('id')
        .eq('slug', entry.storySlug)
        .maybeSingle();
      storyId = (data?.id as string) ?? null;
    }

    await supabase.from('ai_usage').insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      job: entry.job,
      model: entry.model,
      story_id: storyId,
      input_tokens: entry.inputTokens ?? 0,
      output_tokens: entry.outputTokens ?? 0,
      cost_micros: entry.ok
        ? costMicros(entry.model, entry.inputTokens ?? 0, entry.outputTokens ?? 0)
        : 0,
      ok: entry.ok,
      error: entry.error ?? null,
      failure_kind: entry.failureKind ?? null,
      duration_ms: entry.durationMs ?? null,
    });
  } catch {
    // Accounting is not worth a lost draft.
  }
}

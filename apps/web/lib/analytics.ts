import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';

/**
 * Recording what happens, so the dashboard can report something true.
 *
 * `analytics_events` has existed since migration 0010 and nothing has
 * ever written to it. That is why a views-over-time chart could not be
 * built honestly: `stories.view_count` is a running total with no
 * history, and a chart drawn from a single number is a drawing, not a
 * measurement.
 *
 * The RLS policies were already right for this and are worth restating,
 * because they are what makes calling this from a public page safe:
 *
 *   insert  anyone, but only with their own user_id or none at all
 *   select  staff only
 *
 * So a reader can record that they opened a story and cannot read
 * anybody else's events, including their own back.
 */

export type EventName =
  | 'story_opened'
  | 'story_completed'
  | 'story_saved'
  | 'shelf_opened'
  | 'product_viewed';

type TrackOptions = {
  entityType?: string;
  entityId?: string;
  surface?: string;
  properties?: Record<string, unknown>;
};

/**
 * Fire and forget, deliberately.
 *
 * A page must never fail to render because counting failed, and it must
 * never wait on the count either. Errors are swallowed on purpose — the
 * alternative is a story that will not open because the analytics table
 * is busy.
 */
export async function track(name: EventName, options: TrackOptions = {}): Promise<void> {
  if (isDemoMode()) return;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('analytics_events').insert({
      user_id: user?.id ?? null,
      event_name: name,
      entity_type: options.entityType ?? null,
      entity_id: options.entityId ?? null,
      surface: options.surface ?? 'web',
      properties: options.properties ?? {},
    });
  } catch {
    // Counting is not worth an error page.
  }
}

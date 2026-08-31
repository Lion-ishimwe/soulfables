import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';

/**
 * Reading the audit log.
 *
 * The page used to render a fixture array — in live mode as well as in
 * demo — so it showed four invented entries no matter what had actually
 * happened. That is a worse failure than an empty log: an empty log
 * tells you nothing has been recorded, and a fictional one tells you
 * something false.
 */

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: string | null;
  at: string;
  /** Which fields changed, derived from the before/after snapshots. */
  changed: string[];
};

export type AuditFilters = {
  from?: string;
  to?: string;
  /** Minutes past midnight, so a window can be narrower than a day. */
  fromTime?: string;
  toTime?: string;
  entity?: string;
  actor?: string;
};

export const AUDIT_PAGE_SIZE = 50;

/*
 * Columns that change on their own and say nothing about intent. Listing
 * them as "changed" on every entry would bury the one field that
 * actually moved.
 */
const NOISE = new Set(['updated_at', 'created_at', 'search_vector']);

function changedFields(before: unknown, after: unknown): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);

  return [...keys]
    .filter((k) => !NOISE.has(k))
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .sort();
}

/**
 * Combine a date and a time into an instant.
 *
 * The two filters are separate controls because they answer different
 * questions — "what happened last week" and "what happened overnight" —
 * but they resolve to one range. A missing time means the edge of the
 * day, so a date on its own still behaves the way anybody would expect.
 */
function instant(date: string | undefined, time: string | undefined, edge: 'start' | 'end') {
  if (!date) return null;
  const clock = time || (edge === 'start' ? '00:00' : '23:59');
  const seconds = edge === 'start' ? ':00.000' : ':59.999';
  return new Date(`${date}T${clock}${seconds}`).toISOString();
}

export async function listAuditEntries(
  filters: AuditFilters,
  page = 0,
): Promise<{ entries: AuditEntry[]; total: number; live: boolean }> {
  if (isDemoMode()) return { entries: [], total: 0, live: false };

  const supabase = await createClient();

  let q = supabase
    .from('audit_log')
    .select('id, action, entity_type, entity_id, actor_email, created_at, before, after', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(page * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE + AUDIT_PAGE_SIZE - 1);

  const from = instant(filters.from, filters.fromTime, 'start');
  const to = instant(filters.to, filters.toTime, 'end');

  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  if (filters.entity) q = q.eq('entity_type', filters.entity);
  if (filters.actor) q = q.eq('actor_email', filters.actor);

  const { data, count, error } = await q;
  if (error) return { entries: [], total: 0, live: true };

  return {
    live: true,
    total: count ?? 0,
    entries: (data ?? []).map((r) => ({
      id: String(r.id),
      action: r.action as string,
      entityType: (r.entity_type as string) ?? null,
      entityId: (r.entity_id as string) ?? null,
      actor: (r.actor_email as string) ?? null,
      at: r.created_at as string,
      changed: changedFields(r.before, r.after),
    })),
  };
}

/** The entity types and actors that actually appear, for the filters. */
export async function auditFacets(): Promise<{ entities: string[]; actors: string[] }> {
  if (isDemoMode()) return { entities: [], actors: [] };

  const supabase = await createClient();

  /*
   * Sampled from the most recent thousand rather than distinct over the
   * whole table. PostgREST cannot express DISTINCT, and a filter that
   * costs a full scan every time the page loads is a filter that makes
   * the page slower than the thing it filters.
   */
  const { data } = await supabase
    .from('audit_log')
    .select('entity_type, actor_email')
    .order('created_at', { ascending: false })
    .limit(1000);

  const entities = new Set<string>();
  const actors = new Set<string>();
  for (const r of data ?? []) {
    if (r.entity_type) entities.add(r.entity_type as string);
    if (r.actor_email) actors.add(r.actor_email as string);
  }

  return {
    entities: [...entities].sort(),
    actors: [...actors].sort(),
  };
}

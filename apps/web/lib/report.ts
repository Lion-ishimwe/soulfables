import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';

/**
 * The report: what the House has done, and who is here.
 *
 * This replaces two pages that were entirely fixtures — Analytics drew
 * invented events and invented top stories, and Readers listed seven
 * invented people. Merging them without giving them a real source would
 * have moved the fiction rather than removed it.
 *
 * Where a number does not exist yet it reads zero or empty and the page
 * says why, the same rule the dashboard follows.
 */

export type Reader = {
  id: string;
  displayName: string | null;
  email: string;
  role: string;
  plan: 'free' | 'resident';
  joinedAt: string;
  storiesRead: number;
};

export type ReportStory = {
  slug: string;
  title: string;
  opens: number;
  finished: number;
};

export type Report = {
  live: boolean;
  opens: number;
  finished: number;
  purchases: number;
  revenue: number;
  currency: string;
  daily: { date: string; value: number }[];
  topStories: ReportStory[];
  readers: Reader[];
};

const EMPTY: Report = {
  live: false,
  opens: 0,
  finished: 0,
  purchases: 0,
  revenue: 0,
  currency: 'USD',
  daily: [],
  topStories: [],
  readers: [],
};

export async function getReport(days = 30): Promise<Report> {
  if (isDemoMode()) return EMPTY;

  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  /*
   * Four requests, not fourteen. dashboard_series already buckets opens
   * by day in the database — reusing it here costs nothing and keeps one
   * definition of "a story open" rather than two that can drift.
   */
  const [series, readersRes, storiesRes, ordersRes] = await Promise.all([
    supabase.rpc('dashboard_series', { p_days: days }),
    supabase.rpc('reader_report'),
    supabase
      .from('stories')
      .select('slug, title, view_count, completion_count')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(8),
    supabase
      .from('orders')
      .select('total_amount, currency')
      .eq('status', 'paid')
      .gte('paid_at', since),
  ]);

  const s = (series.data ?? {}) as { days?: string[] } & Record<string, number[]>;
  const daily = (s.days ?? []).map((date, i) => ({ date, value: s.opens?.[i] ?? 0 }));

  const readers = ((readersRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.user_id as string,
    displayName: (r.display_name as string) ?? null,
    email: r.email as string,
    role: (r.role as string) ?? 'reader',
    plan: ((r.plan as string) === 'resident' ? 'resident' : 'free') as 'free' | 'resident',
    joinedAt: r.joined_at as string,
    storiesRead: Number(r.stories_read ?? 0),
  }));

  const topStories = ((storiesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
    slug: r.slug as string,
    title: r.title as string,
    opens: Number(r.view_count ?? 0),
    finished: Number(r.completion_count ?? 0),
  }));

  const orders = ordersRes.data ?? [];

  return {
    live: true,
    opens: daily.reduce((sum, d) => sum + d.value, 0),
    finished: topStories.reduce((sum, t) => sum + t.finished, 0),
    purchases: orders.length,
    revenue: orders.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0),
    currency: (orders[0]?.currency as string) ?? 'USD',
    daily,
    topStories,
    readers,
  };
}

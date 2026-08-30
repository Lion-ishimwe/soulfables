import 'server-only';
import { createClient } from './supabase/server';
import { isDemoMode, isLive } from './demo/mode';

/**
 * The numbers behind the dashboard.
 *
 * One rule runs through this file: never invent a number. Where the data
 * exists it is queried; where it does not, the caller is told so and the
 * component renders an empty state rather than a plausible line.
 *
 * That rule costs something. A brand-new House has no orders, no events
 * and no revenue, so most of this dashboard will read zero on the first
 * day. A chart of invented traffic would look better and would be worth
 * nothing — worse than nothing, because someone would eventually make a
 * decision from it.
 */

export type Trend = {
  /** Percentage change against the preceding window. Null when the preceding window was empty — a jump from nothing is not a percentage. */
  percent: number | null;
  direction: 'up' | 'down' | 'flat';
};

export type StatCardData = {
  key: string;
  label: string;
  /** Null when the query failed — rendered as an em dash, never as zero. */
  value: number | null;
  hint: string;
  trend: Trend | null;
  href?: string;
};

export type SeriesPoint = { date: string; value: number };

export type MetricSeries = {
  key: string;
  label: string;
  points: SeriesPoint[];
  total: number;
  /** True when nothing has ever been recorded for this metric. */
  empty: boolean;
  /** Why it is empty, when the reason is structural rather than "no activity yet". */
  note?: string;
};

export type ActivityItem = {
  id: string;
  action: string;
  entityType: string | null;
  actor: string | null;
  at: string;
};

export type TopStory = {
  id: string;
  slug: string;
  title: string;
  coverImage: string | null;
  views: number;
  reads: number;
  /** Mean session length from reading_history. Null when nobody has read it yet — an average of nothing is not zero. */
  avgSeconds: number | null;
  spark: number[];
};

export type RevenueSlice = { label: string; amount: number; percent: number };

/** How many days the dashboard is looking at. */
export const RANGES = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
] as const;

export function rangeFor(key: string | undefined) {
  return RANGES.find((r) => r.key === key) ?? RANGES[1];
}

const DAY = 86_400_000;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString();
}

function trendFrom(current: number, previous: number): Trend {
  if (previous === 0) {
    return { percent: null, direction: current > 0 ? 'up' : 'flat' };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    percent,
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
  };
}

/**
 * Bucket timestamps into one point per day, including the days on which
 * nothing happened. Without the zero days a quiet week looks like a
 * steep line between two busy ones.
 */
function bucketByDay(timestamps: string[], days: number): SeriesPoint[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const t of timestamps) {
    const key = t.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets].map(([date, value]) => ({ date, value }));
}

// ---------------------------------------------------------------------
// Stat row
// ---------------------------------------------------------------------
export async function dashboardStats(days = 30): Promise<StatCardData[]> {
  const blank = (): StatCardData[] => [
    { key: 'published', label: 'Published stories', value: 0, hint: 'Live on the site', trend: null, href: '/admin/stories' },
    { key: 'drafts', label: 'Drafts', value: 0, hint: 'Not yet visible', trend: null, href: '/admin/stories' },
    { key: 'products', label: 'Products', value: 0, hint: 'Active products', trend: null, href: '/admin/products' },
    { key: 'orders', label: 'Paid orders', value: 0, hint: 'Completed orders', trend: null, href: '/admin/orders' },
    { key: 'readers', label: 'Readers', value: 0, hint: 'Registered readers', trend: null, href: '/admin/users' },
    { key: 'stories', label: 'All stories', value: 0, hint: 'Total in database', trend: null, href: '/admin/stories' },
  ];

  if (!isLive()) return blank();

  const supabase = await createClient();

  /*
   * Count a specific column, never '*'.
   *
   * Migration 0015 revoked the table-level select on stories and granted
   * the columns back individually, so `select('*')` is refused there. With
   * head:true that refusal arrives as an error alongside a null count —
   * and `count ?? 0` turns it into a confident zero. The dashboard then
   * reports no stories to a House that has twelve.
   *
   * So: count id, and return null on failure rather than a number. A
   * question that could not be answered must not look like an answer.
   */
  const count = async (table: string, filters: [string, string][] = []) => {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    for (const [col, val] of filters) q = q.eq(col, val);
    const { count: n, error } = await q;
    return error ? null : (n ?? 0);
  };

  /** Rows created inside a window, for the two windows a trend compares. */
  const windowed = async (table: string, column: string, filters: [string, string][] = []) => {
    const build = (from: string, to?: string) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true }).gte(column, from);
      if (to) q = q.lt(column, to);
      for (const [col, val] of filters) q = q.eq(col, val);
      return q;
    };
    const [{ count: recent }, { count: prior }] = await Promise.all([
      build(daysAgo(days)),
      build(daysAgo(days * 2), daysAgo(days)),
    ]);
    return trendFrom(recent ?? 0, prior ?? 0);
  };

  const [
    published,
    drafts,
    products,
    orders,
    readers,
    stories,
    orderTrend,
    readerTrend,
    publishedTrend,
  ] = await Promise.all([
    count('stories', [['status', 'published']]),
    count('stories', [['status', 'draft']]),
    count('products', [['status', 'published']]),
    count('orders', [['status', 'paid']]),
    count('profiles'),
    count('stories'),
    windowed('orders', 'paid_at', [['status', 'paid']]),
    windowed('profiles', 'created_at'),
    windowed('stories', 'published_at', [['status', 'published']]),
  ]);

  return [
    { key: 'published', label: 'Published stories', value: published, hint: 'Live on the site', trend: publishedTrend, href: '/admin/stories' },
    { key: 'drafts', label: 'Drafts', value: drafts, hint: 'Not yet visible', trend: null, href: '/admin/stories' },
    { key: 'products', label: 'Products', value: products, hint: 'Active products', trend: null, href: '/admin/products' },
    { key: 'orders', label: 'Paid orders', value: orders, hint: 'Completed orders', trend: orderTrend, href: '/admin/orders' },
    { key: 'readers', label: 'Readers', value: readers, hint: 'Registered readers', trend: readerTrend, href: '/admin/users' },
    { key: 'stories', label: 'All stories', value: stories, hint: 'Total in database', trend: null, href: '/admin/stories' },
  ];
}

// ---------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------
/**
 * Four metrics over the last 30 days, each from a real timestamp column.
 *
 * Reads and opens come from analytics_events, which only started being
 * written when lib/analytics.ts landed — so they are genuinely empty
 * until traffic arrives, and say so rather than showing a flat zero line
 * that looks like a measurement of nothing happening.
 */
export async function dashboardSeries(days = 30): Promise<MetricSeries[]> {
  const empty = (key: string, label: string, note?: string): MetricSeries => ({
    key,
    label,
    points: bucketByDay([], days),
    total: 0,
    empty: true,
    note,
  });

  if (!isLive()) {
    return [
      empty('opens', 'Story opens', 'Connect a database to record events.'),
      empty('readers', 'New readers'),
      empty('orders', 'Orders'),
      empty('published', 'Published'),
    ];
  }

  const supabase = await createClient();
  const since = daysAgo(days);

  const column = async (table: string, col: string, filters: [string, string][] = []) => {
    let q = supabase.from(table).select(col).gte(col, since).order(col);
    for (const [c, v] of filters) q = q.eq(c, v);
    const { data } = await q;
    return ((data ?? []) as unknown as Record<string, string>[])
      .map((r) => r[col])
      .filter(Boolean);
  };

  const [opens, readers, orders, published] = await Promise.all([
    (async () => {
      const { data } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('event_name', 'story_opened')
        .gte('created_at', since)
        .order('created_at');
      return (data ?? []).map((r) => r.created_at as string);
    })(),
    column('profiles', 'created_at'),
    column('orders', 'paid_at', [['status', 'paid']]),
    column('stories', 'published_at', [['status', 'published']]),
  ]);

  const build = (key: string, label: string, stamps: string[], note?: string): MetricSeries => ({
    key,
    label,
    points: bucketByDay(stamps, days),
    total: stamps.length,
    empty: stamps.length === 0,
    note: stamps.length === 0 ? note : undefined,
  });

  return [
    build('opens', 'Story opens', opens, 'Nothing recorded yet. Events begin the first time somebody opens a story.'),
    build('readers', 'New readers', readers, 'No accounts created in this window.'),
    build('orders', 'Orders', orders, 'No paid orders yet — checkout is the last milestone.'),
    build('published', 'Published', published, 'Nothing published in this window.'),
  ];
}

// ---------------------------------------------------------------------
// Side panels
// ---------------------------------------------------------------------
export async function recentActivity(limit = 5): Promise<ActivityItem[]> {
  if (!isLive()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('audit_log')
    .select('id, action, entity_type, actor_email, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: String(r.id),
    action: r.action as string,
    entityType: (r.entity_type as string) ?? null,
    actor: (r.actor_email as string) ?? null,
    at: r.created_at as string,
  }));
}

/**
 * Ordered by views, which is a lifetime counter rather than a windowed
 * one — so this is "most read ever", not "most read this month". Said
 * plainly in the panel heading rather than left to be assumed.
 */
export async function topStories(limit = 5): Promise<TopStory[]> {
  if (!isLive()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('stories')
    .select('id, slug, title, cover_image, view_count, completion_count')
    .eq('status', 'published')
    .order('view_count', { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  /*
   * Average read time, aggregated here rather than in the query.
   *
   * PostgREST cannot group, and a view for this would be a migration for
   * five numbers. Fetching the sessions for these five stories and taking
   * the mean in JavaScript is the smaller thing, and it stays correct if
   * the panel later shows ten.
   */
  const ids = rows.map((r) => r.id as string);
  const { data: sessions } = await supabase
    .from('reading_history')
    .select('story_id, duration_seconds')
    .in('story_id', ids);

  const totals = new Map<string, { sum: number; n: number }>();
  for (const s of sessions ?? []) {
    const seconds = Number(s.duration_seconds ?? 0);
    if (!seconds) continue;
    const key = s.story_id as string;
    const acc = totals.get(key) ?? { sum: 0, n: 0 };
    acc.sum += seconds;
    acc.n += 1;
    totals.set(key, acc);
  }

  return rows.map((r) => {
    const acc = totals.get(r.id as string);
    return {
      id: r.id as string,
      slug: r.slug as string,
      title: r.title as string,
      coverImage: (r.cover_image as string) ?? null,
      views: Number(r.view_count ?? 0),
      reads: Number(r.completion_count ?? 0),
      avgSeconds: acc ? Math.round(acc.sum / acc.n) : null,
      // No per-story daily history is kept, so there is no sparkline to
      // draw. An empty array renders nothing; a random one renders a lie.
      spark: [],
    };
  });
}

export async function revenueByKind(): Promise<{ total: number; currency: string; slices: RevenueSlice[] }> {
  if (!isLive()) return { total: 0, currency: 'USD', slices: [] };

  const supabase = await createClient();
  const { data } = await supabase
    .from('orders')
    .select('id, total_amount, currency')
    .eq('status', 'paid');

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + Number(r.total_amount ?? 0), 0);
  const currency = (rows[0]?.currency as string) ?? 'USD';

  if (rows.length === 0) return { total: 0, currency, slices: [] };

  /*
   * Split by what was actually bought, through order_items, rather than
   * by guessing from the order total. An order can hold several kinds.
   */
  const { data: items } = await supabase
    .from('order_items')
    .select('unit_amount, quantity, products(kind)')
    .in('order_id', rows.map((r) => r.id as string));

  const byKind = new Map<string, number>();
  for (const item of items ?? []) {
    const product = item.products as { kind?: string } | null;
    const kind = product?.kind ?? 'other';
    const amount = Number(item.unit_amount ?? 0) * Number(item.quantity ?? 1);
    byKind.set(kind, (byKind.get(kind) ?? 0) + amount);
  }

  const sum = [...byKind.values()].reduce((a, b) => a + b, 0);
  const slices: RevenueSlice[] = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, amount]) => ({
      label: kind.charAt(0).toUpperCase() + kind.slice(1),
      amount,
      percent: sum > 0 ? Math.round((amount / sum) * 100) : 0,
    }));

  return { total, currency, slices };
}

export function isDashboardLive(): boolean {
  return !isDemoMode();
}

/**
 * Unread notifications for the person looking at the dashboard.
 *
 * Their own only — the RLS policy on notifications is scoped to
 * auth.uid(), so this cannot accidentally count somebody else's.
 */
export async function unreadNotifications(): Promise<number> {
  if (!isLive()) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);

  return error ? 0 : (count ?? 0);
}

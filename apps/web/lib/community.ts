import 'server-only';
import { isDemoMode } from './demo/mode';
import { getViewer } from './auth';

/**
 * The community: people connecting through stories.
 *
 * Reads only. Every public read goes through the anonymous client, and
 * the database decides what is visible: published posts and replies,
 * a reader's own whatever their state, and everything for staff.
 */

export type ReactionKind = 'seen' | 'held' | 'thank_you';
export const REACTIONS: { kind: ReactionKind; label: string }[] = [
  { kind: 'seen', label: 'Seen' },
  { kind: 'held', label: 'Held' },
  { kind: 'thank_you', label: 'Thank you' },
];

export type Challenge = {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

export type Post = {
  id: string;
  userId: string;
  authorName: string;
  anonymous: boolean;
  kind: 'story' | 'reflection' | 'response';
  title: string | null;
  body: string;
  challengeId: string | null;
  challengeTitle: string | null;
  status: 'pending' | 'published' | 'rejected' | 'removed';
  reviewNote: string | null;
  createdAt: string;
  publishedAt: string | null;
  reactions: Record<ReactionKind, number>;
  replies: number;
};

export type Reply = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  body: string;
  status: 'pending' | 'published' | 'removed';
  createdAt: string;
};

export type Report = {
  id: string;
  targetType: 'post' | 'reply';
  targetId: string;
  reason: string;
  note: string | null;
  createdAt: string;
  /** What was reported, as far as it can be shown. */
  snippet: string | null;
};

const DEMO_POSTS: Post[] = [
  {
    id: 'demo-post-1', userId: 'demo', authorName: 'A reader', anonymous: true, kind: 'reflection', title: 'The chair by the window',
    body: 'I kept his chair. Not because it is comfortable — it is not — but because it faces the window the way he used to face it, and when I sit in it the room is arranged around somebody who is not there, and that is closer to the truth than the room being arranged around me.',
    challengeId: null, challengeTitle: 'The Thing You Kept', status: 'published', reviewNote: null,
    createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString(), publishedAt: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    reactions: { seen: 12, held: 7, thank_you: 4 }, replies: 2,
  },
  {
    id: 'demo-post-2', userId: 'demo', authorName: 'Seren', anonymous: false, kind: 'story', title: 'Small hours',
    body: 'There is a bakery on my street that opens at four. I did not know this until the month I stopped sleeping. The woman who runs it never asked why I was there. She gave me the first roll of the day and said it was not fit to sell, which was a lie, and I ate it on the step while the street stayed dark, and for that half hour I was somebody with somewhere to be.',
    challengeId: null, challengeTitle: null, status: 'published', reviewNote: null,
    createdAt: new Date(Date.now() - 86_400_000 * 5).toISOString(), publishedAt: new Date(Date.now() - 86_400_000 * 5).toISOString(),
    reactions: { seen: 30, held: 19, thank_you: 11 }, replies: 3,
  },
];

const DEMO_CHALLENGE: Challenge = {
  id: 'demo-challenge', slug: 'the-thing-you-kept', title: 'The Thing You Kept',
  prompt: 'Write about one object you kept after a season ended — what it is, where it lives now, and what it holds.',
  startsOn: new Date().toISOString().slice(0, 10), endsOn: new Date(Date.now() + 86_400_000 * 21).toISOString().slice(0, 10), isActive: true,
};

function emptyReactions(): Record<ReactionKind, number> {
  return { seen: 0, held: 0, thank_you: 0 };
}

function postOf(r: Record<string, unknown>): Post {
  const ch = (Array.isArray(r.community_challenges) ? r.community_challenges[0] : r.community_challenges) as { title?: string } | null;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    authorName: (r.author_name as string) ?? 'A reader',
    anonymous: Boolean(r.anonymous),
    kind: (r.kind as Post['kind']) ?? 'reflection',
    title: (r.title as string) ?? null,
    body: r.body as string,
    challengeId: (r.challenge_id as string) ?? null,
    challengeTitle: ch?.title ?? null,
    status: (r.status as Post['status']) ?? 'pending',
    reviewNote: (r.review_note as string) ?? null,
    createdAt: r.created_at as string,
    publishedAt: (r.published_at as string) ?? null,
    reactions: emptyReactions(),
    replies: 0,
  };
}

async function decorate(posts: Post[], client: { from: (t: string) => any }): Promise<Post[]> {
  if (posts.length === 0) return posts;
  const ids = posts.map((p) => p.id);
  const [{ data: reactions }, { data: replies }] = await Promise.all([
    client.from('community_reactions').select('post_id, kind').in('post_id', ids),
    client.from('community_replies').select('post_id').in('post_id', ids).eq('status', 'published'),
  ]);
  const byId = new Map(posts.map((p) => [p.id, p]));
  for (const r of (reactions ?? []) as { post_id: string; kind: ReactionKind }[]) {
    const p = byId.get(r.post_id);
    if (p) p.reactions[r.kind] = (p.reactions[r.kind] ?? 0) + 1;
  }
  for (const r of (replies ?? []) as { post_id: string }[]) {
    const p = byId.get(r.post_id);
    if (p) p.replies += 1;
  }
  return posts;
}

const POST_SELECT = 'id, user_id, author_name, anonymous, kind, title, body, challenge_id, status, review_note, created_at, published_at, community_challenges(title)';

/** The wall: published posts, newest first. */
export async function listPublishedPosts(limit = 40, challengeId?: string): Promise<Post[]> {
  if (isDemoMode()) return DEMO_POSTS;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  let q = supabase.from('community_posts').select(POST_SELECT).eq('status', 'published').order('published_at', { ascending: false }).limit(limit);
  if (challengeId) q = q.eq('challenge_id', challengeId);
  const { data, error } = await q;
  if (error) {
    console.error('[community] wall', error.message);
    return [];
  }
  return decorate((data ?? []).map((r) => postOf(r as Record<string, unknown>)), supabase);
}

/** One post as this reader may see it, with the reactions they gave and the replies that show. */
export async function getPost(id: string): Promise<{ post: Post; mine: ReactionKind[]; replies: Reply[] } | null> {
  if (isDemoMode()) {
    const post = DEMO_POSTS.find((p) => p.id === id);
    if (!post) return null;
    return {
      post,
      mine: [],
      replies: [
        { id: 'demo-reply-1', postId: id, userId: 'demo', authorName: 'Amara', body: 'I read this twice. Thank you for the chair.', status: 'published', createdAt: new Date(Date.now() - 86_400_000).toISOString() },
      ],
    };
  }
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data, error } = await supabase.from('community_posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const [post] = await decorate([postOf(data as Record<string, unknown>)], supabase);
  const [{ data: mine }, { data: replies }] = await Promise.all([
    viewer
      ? supabase.from('community_reactions').select('kind').eq('post_id', id).eq('user_id', viewer.id)
      : Promise.resolve({ data: [] as { kind: ReactionKind }[] }),
    supabase.from('community_replies').select('id, post_id, user_id, author_name, body, status, created_at').eq('post_id', id).order('created_at'),
  ]);
  return {
    post,
    mine: ((mine ?? []) as { kind: ReactionKind }[]).map((m) => m.kind),
    replies: ((replies ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      postId: r.post_id as string,
      userId: r.user_id as string,
      authorName: (r.author_name as string) ?? 'A reader',
      body: r.body as string,
      status: (r.status as Reply['status']) ?? 'pending',
      createdAt: r.created_at as string,
    })),
  };
}

/** The reader's own posts, whatever their state, so they can see where each one is. */
export async function listMyPosts(): Promise<Post[]> {
  if (isDemoMode()) return [];
  const viewer = await getViewer();
  if (!viewer) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('community_posts').select(POST_SELECT).eq('user_id', viewer.id).order('created_at', { ascending: false }).limit(20);
  return decorate((data ?? []).map((r) => postOf(r as Record<string, unknown>)), supabase);
}

function challengeOf(r: Record<string, unknown>): Challenge {
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    prompt: r.prompt as string,
    startsOn: r.starts_on as string,
    endsOn: r.ends_on as string,
    isActive: r.is_active !== false,
  };
}

/** The challenge running today, if one is. */
export async function getActiveChallenge(): Promise<Challenge | null> {
  if (isDemoMode()) return DEMO_CHALLENGE;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('community_challenges')
    .select('id, slug, title, prompt, starts_on, ends_on, is_active')
    .eq('is_active', true)
    .lte('starts_on', today)
    .gte('ends_on', today)
    .order('starts_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? challengeOf(data as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------

export async function listChallenges(): Promise<Challenge[]> {
  if (isDemoMode()) return [DEMO_CHALLENGE];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('community_challenges').select('id, slug, title, prompt, starts_on, ends_on, is_active').order('starts_on', { ascending: false });
  return (data ?? []).map((r) => challengeOf(r as Record<string, unknown>));
}

export async function listPendingPosts(): Promise<(Post & { trusted: boolean })[]> {
  if (isDemoMode()) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('community_posts').select(POST_SELECT).eq('status', 'pending').order('created_at');
  const posts = (data ?? []).map((r) => postOf(r as Record<string, unknown>));
  const trusted = await trustedSet(posts.map((p) => p.userId));
  return posts.map((p) => ({ ...p, trusted: trusted.has(p.userId) }));
}

export async function listPendingReplies(): Promise<(Reply & { postTitle: string | null; trusted: boolean })[]> {
  if (isDemoMode()) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase
    .from('community_replies')
    .select('id, post_id, user_id, author_name, body, status, created_at, community_posts(title)')
    .eq('status', 'pending')
    .order('created_at');
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const post = (Array.isArray(r.community_posts) ? r.community_posts[0] : r.community_posts) as { title?: string } | null;
    return {
      id: r.id as string,
      postId: r.post_id as string,
      userId: r.user_id as string,
      authorName: (r.author_name as string) ?? 'A reader',
      body: r.body as string,
      status: 'pending' as const,
      createdAt: r.created_at as string,
      postTitle: post?.title ?? null,
    };
  });
  const trusted = await trustedSet(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, trusted: trusted.has(r.userId) }));
}

export async function listOpenReports(): Promise<Report[]> {
  if (isDemoMode()) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('community_reports').select('id, target_type, target_id, reason, note, created_at').eq('status', 'open').order('created_at');
  const reports = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    targetType: r.target_type as 'post' | 'reply',
    targetId: r.target_id as string,
    reason: r.reason as string,
    note: (r.note as string) ?? null,
    createdAt: r.created_at as string,
    snippet: null as string | null,
  }));
  const postIds = reports.filter((r) => r.targetType === 'post').map((r) => r.targetId);
  const replyIds = reports.filter((r) => r.targetType === 'reply').map((r) => r.targetId);
  const [{ data: posts }, { data: replies }] = await Promise.all([
    postIds.length ? supabase.from('community_posts').select('id, title, body').in('id', postIds) : Promise.resolve({ data: [] }),
    replyIds.length ? supabase.from('community_replies').select('id, body').in('id', replyIds) : Promise.resolve({ data: [] }),
  ]);
  const snip = new Map<string, string>();
  for (const p of (posts ?? []) as { id: string; title: string | null; body: string }[]) snip.set(p.id, `${p.title ? `${p.title}: ` : ''}${p.body.slice(0, 160)}`);
  for (const r of (replies ?? []) as { id: string; body: string }[]) snip.set(r.id, r.body.slice(0, 160));
  return reports.map((r) => ({ ...r, snippet: snip.get(r.targetId) ?? null }));
}

async function trustedSet(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('id').in('id', [...new Set(userIds)]).eq('trusted', true);
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

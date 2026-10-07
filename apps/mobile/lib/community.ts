import { supabase } from './supabase';

/**
 * Residents: the community wall, read and written under the same rules
 * as the site.
 *
 * Published posts are public. A reader's own posts and replies are
 * visible to them while they wait for a person to read them. Nothing a
 * reader writes is public until approved; a post goes in as pending and
 * the wall says so to its author.
 */

export type ReactionKind = 'seen' | 'held' | 'thank_you';
export const REACTIONS: { kind: ReactionKind; glyph: string; label: string }[] = [
  { kind: 'held', glyph: '♥', label: 'Held' },
  { kind: 'seen', glyph: '◌', label: 'Seen' },
  { kind: 'thank_you', glyph: '✦', label: 'Thank you' },
];

export type Post = {
  id: string;
  userId: string;
  authorName: string;
  kind: string;
  title: string | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'removed';
  createdAt: string;
  publishedAt: string | null;
  challenge: string | null;
  reactions: Record<ReactionKind, number>;
  replies: number;
};

export type Reply = { id: string; authorName: string; body: string; status: string; createdAt: string; userId: string };

export type Challenge = { id: string; slug: string; title: string; prompt: string; startsOn: string; endsOn: string; isActive: boolean };

const SELECT = 'id, user_id, author_name, kind, title, body, status, created_at, published_at, community_challenges(title)';

async function decorate(rows: Record<string, unknown>[]): Promise<Post[]> {
  const ids = rows.map((r) => r.id as string);
  const base: Record<ReactionKind, number> = { seen: 0, held: 0, thank_you: 0 };
  const reactions = new Map<string, Record<ReactionKind, number>>();
  const replies = new Map<string, number>();
  if (ids.length) {
    const [{ data: rx }, { data: rp }] = await Promise.all([
      supabase.from('community_reactions').select('post_id, kind').in('post_id', ids),
      supabase.from('community_replies').select('post_id').in('post_id', ids).eq('status', 'published'),
    ]);
    for (const r of (rx ?? []) as { post_id: string; kind: ReactionKind }[]) {
      const cur = reactions.get(r.post_id) ?? { ...base };
      if (r.kind in cur) cur[r.kind] += 1;
      reactions.set(r.post_id, cur);
    }
    for (const r of (rp ?? []) as { post_id: string }[]) replies.set(r.post_id, (replies.get(r.post_id) ?? 0) + 1);
  }
  return rows.map((r) => {
    const ch = r.community_challenges as { title: string } | { title: string }[] | null;
    const challenge = Array.isArray(ch) ? (ch[0]?.title ?? null) : (ch?.title ?? null);
    return {
      id: r.id as string,
      userId: r.user_id as string,
      authorName: (r.author_name as string) ?? 'Someone in the House',
      kind: (r.kind as string) ?? 'reflection',
      title: (r.title as string) ?? null,
      body: r.body as string,
      status: r.status as Post['status'],
      createdAt: r.created_at as string,
      publishedAt: (r.published_at as string) ?? null,
      challenge,
      reactions: reactions.get(r.id as string) ?? { ...base },
      replies: replies.get(r.id as string) ?? 0,
    };
  });
}

export async function listPosts(): Promise<Post[]> {
  const { data, error } = await supabase.from('community_posts').select(SELECT).eq('status', 'published').order('published_at', { ascending: false }).limit(40);
  if (error) throw new Error(error.message);
  return decorate((data ?? []) as Record<string, unknown>[]);
}

export async function listMyPending(userId: string): Promise<Post[]> {
  const { data } = await supabase.from('community_posts').select(SELECT).eq('user_id', userId).neq('status', 'published').order('created_at', { ascending: false }).limit(10);
  return decorate((data ?? []) as Record<string, unknown>[]);
}

export async function listChallenges(): Promise<Challenge[]> {
  const { data } = await supabase.from('community_challenges').select('id, slug, title, prompt, starts_on, ends_on, is_active').eq('is_active', true).order('starts_on', { ascending: false });
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    prompt: String(r.prompt).replace(/\r\n?/g, '\n'),
    startsOn: r.starts_on as string,
    endsOn: r.ends_on as string,
    isActive: Boolean(r.is_active),
  }));
}

/** The challenge whose dates hold today, or the newest active one. */
export async function getActiveChallenge(): Promise<Challenge | null> {
  const all = await listChallenges();
  const today = new Date().toISOString().slice(0, 10);
  return all.find((c) => c.startsOn <= today && c.endsOn >= today) ?? all[0] ?? null;
}

export async function getPost(id: string, userId: string | null): Promise<{ post: Post; mine: ReactionKind[]; replies: Reply[] } | null> {
  const { data } = await supabase.from('community_posts').select(SELECT).eq('id', id).maybeSingle();
  if (!data) return null;
  const [post] = await decorate([data as Record<string, unknown>]);
  const [{ data: mine }, { data: rp }] = await Promise.all([
    userId ? supabase.from('community_reactions').select('kind').eq('post_id', id).eq('user_id', userId) : Promise.resolve({ data: [] as { kind: ReactionKind }[] }),
    supabase.from('community_replies').select('id, user_id, author_name, body, status, created_at').eq('post_id', id).order('created_at'),
  ]);
  return {
    post,
    mine: ((mine ?? []) as { kind: ReactionKind }[]).map((m) => m.kind),
    replies: ((rp ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      authorName: (r.author_name as string) ?? 'Someone in the House',
      body: r.body as string,
      status: r.status as string,
      createdAt: r.created_at as string,
    })),
  };
}

async function nameFor(userId: string, anonymous: boolean): Promise<string> {
  if (anonymous) return 'Someone in the House';
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  return ((data as { display_name?: string } | null)?.display_name || 'A reader').trim();
}

export async function submitPost(input: { userId: string; title?: string; body: string; anonymous: boolean; kind?: 'story' | 'reflection'; challengeId?: string | null }): Promise<void> {
  const { error } = await supabase.from('community_posts').insert({
    user_id: input.userId,
    author_name: await nameFor(input.userId, input.anonymous),
    anonymous: input.anonymous,
    kind: input.challengeId ? 'response' : (input.kind ?? 'reflection'),
    title: input.title?.trim() || null,
    body: input.body.trim(),
    challenge_id: input.challengeId ?? null,
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function submitReply(input: { userId: string; postId: string; body: string }): Promise<void> {
  const { error } = await supabase.from('community_replies').insert({
    post_id: input.postId,
    user_id: input.userId,
    author_name: await nameFor(input.userId, false),
    body: input.body.trim(),
    status: 'pending',
  });
  if (error) throw new Error(error.message);
}

export async function toggleReaction(postId: string, userId: string, kind: ReactionKind, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase.from('community_reactions').insert({ post_id: postId, user_id: userId, kind })
    : await supabase.from('community_reactions').delete().eq('post_id', postId).eq('user_id', userId).eq('kind', kind);
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
}

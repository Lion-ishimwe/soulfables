'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { getViewer, requireStaff, requireViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitFor, HOUR, waitMessage } from '@/lib/rate-limit';

/**
 * The community's actions.
 *
 * Readers write; the House reads first. Every write from a reader lands
 * pending, except a reply from a reader the House has marked trusted.
 * Blocked words stop a thing before it is written. Rate limits keep one
 * person from filling the queue.
 */

export type CommunityResult = { error?: string; message?: string };

const DAY = 24 * HOUR;

async function blockedWord(text: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from('house_settings').select('community_blocked_words').eq('id', 1).maybeSingle();
  const words = String(data?.community_blocked_words ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  const lower = text.toLowerCase();
  return words.find((w) => lower.includes(w)) ?? null;
}

async function nameFor(viewerName: string | null, penName: string, anonymous: boolean): Promise<string> {
  if (anonymous) return 'Anonymous';
  return penName.trim() || viewerName?.trim() || 'A reader';
}

// ---------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------

const postSchema = z.object({
  title: z.string().trim().max(120).optional().or(z.literal('')),
  body: z.string().trim().min(40, 'Say a little more — forty characters at least.').max(4000, 'That is longer than the wall can hold. Four thousand characters.'),
  kind: z.enum(['story', 'reflection']).catch('reflection'),
  penName: z.string().trim().max(40).optional().or(z.literal('')),
  anonymous: z.boolean().default(false),
  challengeId: z.string().trim().max(64).optional().or(z.literal('')),
});

export async function submitPost(_prev: CommunityResult, formData: FormData): Promise<CommunityResult> {
  const viewer = await requireViewer('/community/share');
  if (isDemoMode()) return { error: 'The demo keeps its wall as it is. Connect a database and readers can write to it.' };

  const parsed = postSchema.safeParse({
    title: field(formData, 'title'),
    body: field(formData, 'body'),
    kind: field(formData, 'kind'),
    penName: field(formData, 'penName'),
    anonymous: checkbox(formData, 'anonymous'),
    challengeId: field(formData, 'challengeId'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const limit = await limitFor('community-post', viewer.id, 3, DAY);
  if (!limit.ok) return { error: waitMessage(limit) };

  const blocked = await blockedWord(`${d.title ?? ''} ${d.body}`);
  if (blocked) return { error: 'Something in this cannot go on the wall. Read it once more, and take out what would hurt.' };

  const supabase = await createClient();
  const { error } = await supabase.from('community_posts').insert({
    user_id: viewer.id,
    author_name: await nameFor(viewer.displayName, d.penName ?? '', d.anonymous),
    anonymous: d.anonymous,
    kind: d.challengeId ? 'response' : d.kind,
    title: d.title || null,
    body: d.body,
    challenge_id: d.challengeId || null,
    status: 'pending',
  });
  if (error) return { error: error.message };

  revalidatePath('/community');
  redirect('/community?sent=1' as Route);
}

export async function toggleReaction(formData: FormData): Promise<void> {
  const viewer = await getViewer();
  const postId = field(formData, 'postId') ?? '';
  const kind = field(formData, 'kind') ?? '';
  if (!viewer) redirect(`/signin?next=${encodeURIComponent(`/community/${postId}`)}` as Route);
  if (isDemoMode() || !postId || !['seen', 'held', 'thank_you'].includes(kind)) return;

  const limit = await limitFor('community-react', viewer.id, 200, HOUR);
  if (!limit.ok) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('community_reactions')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', viewer.id)
    .eq('kind', kind)
    .maybeSingle();
  if (existing) {
    await supabase.from('community_reactions').delete().eq('post_id', postId).eq('user_id', viewer.id).eq('kind', kind);
  } else {
    await supabase.from('community_reactions').insert({ post_id: postId, user_id: viewer.id, kind });
  }
  revalidatePath(`/community/${postId}`);
  revalidatePath('/community');
}

const replySchema = z.object({
  body: z.string().trim().min(2, 'Say something.').max(1500, 'A reply is a few lines. Fifteen hundred characters at most.'),
});

export async function submitReply(_prev: CommunityResult, formData: FormData): Promise<CommunityResult> {
  const postId = field(formData, 'postId') ?? '';
  const viewer = await requireViewer(`/community/${postId}`);
  if (isDemoMode()) return { error: 'The demo keeps its wall as it is.' };

  const parsed = replySchema.safeParse({ body: field(formData, 'body') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limit = await limitFor('community-reply', viewer.id, 20, DAY);
  if (!limit.ok) return { error: waitMessage(limit) };

  const blocked = await blockedWord(parsed.data.body);
  if (blocked) return { error: 'Something in this cannot go under a post. Read it once more.' };

  const supabase = await createClient();
  const { data: me } = await supabase.from('profiles').select('trusted').eq('id', viewer.id).maybeSingle();
  const trusted = Boolean(me?.trusted);
  const authorName = await nameFor(viewer.displayName, '', false);

  if (trusted) {
    // A trusted reader's words publish at once. The service role writes
    // the published state the policy would otherwise refuse.
    const { error } = await createAdminClient().from('community_replies').insert({
      post_id: postId,
      user_id: viewer.id,
      author_name: authorName,
      body: parsed.data.body,
      status: 'published',
      published_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from('community_replies').insert({
      post_id: postId,
      user_id: viewer.id,
      author_name: authorName,
      body: parsed.data.body,
      status: 'pending',
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/community/${postId}`);
  revalidatePath('/community');
  return { message: trusted ? 'Under the post.' : 'Kept. The House reads replies before they appear; yours will be there soon.' };
}

const REASONS = ['unkind', 'unsafe', 'spam', 'other'] as const;

export async function reportContent(formData: FormData): Promise<void> {
  const targetType = field(formData, 'targetType') ?? '';
  const targetId = field(formData, 'targetId') ?? '';
  const postId = field(formData, 'postId') ?? targetId;
  const viewer = await requireViewer(`/community/${postId}`);
  if (isDemoMode()) redirect(`/community/${postId}?reported=1` as Route);
  const reason = (field(formData, 'reason') ?? 'other') as (typeof REASONS)[number];
  const note = (field(formData, 'note') ?? '').slice(0, 500);
  if (!['post', 'reply'].includes(targetType) || !targetId || !REASONS.includes(reason)) return;

  const limit = await limitFor('community-report', viewer.id, 20, DAY);
  if (!limit.ok) return;

  const supabase = await createClient();
  await supabase.from('community_reports').insert({ target_type: targetType, target_id: targetId, user_id: viewer.id, reason, note: note || null });
  redirect(`/community/${postId}?reported=1` as Route);
}

// ---------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------

async function note(action: string, entityType: string, id: string, after: unknown) {
  try {
    const viewer = await requireStaff();
    const supabase = await createClient();
    await supabase.from('audit_log').insert({ action, entity_type: entityType, entity_id: id, actor_id: viewer.id, actor_email: viewer.email ?? null, after });
  } catch (e) {
    console.error('[community] audit not written', e instanceof Error ? e.message : e);
  }
}

function freshen(postId?: string) {
  revalidatePath('/community');
  revalidatePath('/admin/community');
  if (postId) revalidatePath(`/community/${postId}`);
}

export async function reviewPost(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  if (isDemoMode()) return;
  const id = field(formData, 'id') ?? '';
  const decision = field(formData, 'decision') === 'approve' ? 'published' : 'rejected';
  const reviewNote = (field(formData, 'note') ?? '').slice(0, 500) || null;
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from('community_posts')
    .update({ status: decision, review_note: reviewNote, reviewed_by: viewer.id, reviewed_at: new Date().toISOString(), published_at: decision === 'published' ? new Date().toISOString() : null })
    .eq('id', id);
  await note(decision === 'published' ? 'community.post.approve' : 'community.post.reject', 'community_post', id, { note: reviewNote });
  freshen(id);
  redirect('/admin/community?done=1' as Route);
}

export async function reviewReply(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  if (isDemoMode()) return;
  const id = field(formData, 'id') ?? '';
  const postId = field(formData, 'postId') ?? '';
  const decision = field(formData, 'decision') === 'approve' ? 'published' : 'removed';
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from('community_replies')
    .update({ status: decision, reviewed_by: viewer.id, published_at: decision === 'published' ? new Date().toISOString() : null })
    .eq('id', id);
  await note(decision === 'published' ? 'community.reply.approve' : 'community.reply.remove', 'community_reply', id, {});
  freshen(postId);
  redirect('/admin/community?done=1' as Route);
}

export async function removeContent(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  if (isDemoMode()) return;
  const targetType = field(formData, 'targetType') ?? '';
  const targetId = field(formData, 'targetId') ?? '';
  const reportId = field(formData, 'reportId') ?? '';
  const keep = field(formData, 'keep') === '1';
  if (!targetId) return;
  const supabase = await createClient();
  if (!keep) {
    if (targetType === 'post') {
      await supabase.from('community_posts').update({ status: 'removed', reviewed_by: viewer.id, reviewed_at: new Date().toISOString() }).eq('id', targetId);
    } else if (targetType === 'reply') {
      await supabase.from('community_replies').update({ status: 'removed', reviewed_by: viewer.id }).eq('id', targetId);
    }
    await note(`community.${targetType}.remove`, `community_${targetType}`, targetId, { via: reportId ? 'report' : 'queue' });
  }
  if (reportId) {
    await supabase.from('community_reports').update({ status: 'closed', closed_by: viewer.id, closed_at: new Date().toISOString() }).eq('id', reportId);
  }
  freshen(targetType === 'post' ? targetId : undefined);
  redirect('/admin/community?done=1' as Route);
}

export async function setTrusted(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;
  const userId = field(formData, 'userId') ?? '';
  const trusted = field(formData, 'trusted') === '1';
  if (!userId) return;
  await createAdminClient().from('profiles').update({ trusted }).eq('id', userId);
  await note(trusted ? 'community.reader.trust' : 'community.reader.untrust', 'profile', userId, {});
  freshen();
  redirect('/admin/community?done=1' as Route);
}

const challengeSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.').max(80),
  title: z.string().trim().min(1, 'A challenge needs a title.').max(120),
  prompt: z.string().trim().min(10, 'Write the prompt.').max(600),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A start date.'),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'An end date.'),
  isActive: z.boolean().default(true),
});

export async function saveChallenge(_prev: CommunityResult, formData: FormData): Promise<CommunityResult> {
  await requireStaff();
  if (isDemoMode()) return { error: 'The demo keeps its challenge as it is.' };
  const original = field(formData, 'originalSlug') || null;
  const parsed = challengeSchema.safeParse({
    slug: field(formData, 'slug'),
    title: field(formData, 'title'),
    prompt: field(formData, 'prompt'),
    startsOn: field(formData, 'startsOn'),
    endsOn: field(formData, 'endsOn'),
    isActive: checkbox(formData, 'isActive'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.endsOn < d.startsOn) return { error: 'It cannot end before it begins.' };
  const supabase = await createClient();
  const row = { slug: d.slug, title: d.title, prompt: d.prompt, starts_on: d.startsOn, ends_on: d.endsOn, is_active: d.isActive };
  const { error } = original
    ? await supabase.from('community_challenges').update(row).eq('slug', original)
    : await supabase.from('community_challenges').insert(row);
  if (error) return { error: error.code === '23505' ? 'Another challenge uses that address.' : error.message };
  freshen();
  redirect(`/admin/community?saved=${encodeURIComponent(d.title)}` as Route);
}

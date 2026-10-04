'use server';

import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { field } from '@/lib/form';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailConfigured, sendLetterIssue } from '@/lib/email';
import { getLetterForEditing, nextLetterNumber, renderLetterHtml, slugifyLetter } from '@/lib/letters';

export type LetterResult = { error?: string; message?: string };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

const letterSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  title: z.string().trim().min(1, 'A letter needs a title.').max(200),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  dek: z.string().trim().max(200).optional().or(z.literal('')),
  body: z.string().trim().min(1, 'The letter has nothing in it yet.').max(60000),
  featuredStoryId: z.string().uuid().optional().or(z.literal('')),
});

/**
 * Write or rewrite a letter. A draft until it is sent; a sent letter can
 * still be corrected on its page, but what went out has gone out.
 */
export async function saveLetter(_prev: LetterResult, formData: FormData): Promise<LetterResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'The demo keeps no letters.' };

  const parsed = letterSchema.safeParse({
    id: field(formData, 'id'),
    title: field(formData, 'title'),
    subject: field(formData, 'subject'),
    dek: field(formData, 'dek'),
    body: field(formData, 'body'),
    featuredStoryId: field(formData, 'featuredStoryId'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const row = {
    title: d.title,
    subject: d.subject || null,
    dek: d.dek || null,
    body_mdx: d.body,
    featured_story_id: d.featuredStoryId || null,
  };

  let id = d.id || '';
  if (id) {
    const { error } = await supabase.from('letters').update(row).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const number = await nextLetterNumber();
    const { data, error } = await supabase
      .from('letters')
      .insert({ ...row, volume: 1, number, slug: slugifyLetter(d.title, number), status: 'draft' })
      .select('id')
      .single();
    if (error) return { error: error.code === '23505' ? 'A letter with that address already exists; change the title a little.' : error.message };
    id = data.id as string;
  }

  await supabase.from('audit_log').insert({ action: 'letter.saved', entity_type: 'letter', entity_id: id, actor_id: viewer.id, actor_email: viewer.email ?? null, after: { title: d.title } });
  revalidatePath('/admin/letter');
  if (!d.id) redirect(`/admin/letter/${id}?saved=1` as Route);
  return { message: 'Saved.' };
}

/** The letter, sent to the person editing it and nobody else. */
export async function sendLetterTest(_prev: LetterResult, formData: FormData): Promise<LetterResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'The demo sends nothing.' };
  if (!emailConfigured()) return { error: 'No email service is connected.' };
  if (!viewer.email) return { error: 'Your account has no email address to send to.' };
  const id = field(formData, 'id') ?? '';
  const letter = await getLetterForEditing(id);
  if (!letter) return { error: 'Save the letter first.' };

  const result = await sendLetterIssue({
    to: viewer.email,
    subject: `[Test] ${letter.subject || letter.title}`,
    title: letter.title,
    dek: letter.dek,
    bodyHtml: renderLetterHtml(letter.body),
    bodyText: letter.body,
    story: letter.featuredStory ? { title: letter.featuredStory.title, url: `${SITE}/story/${letter.featuredStory.slug}` } : null,
    unsubscribeUrl: null,
    letterId: letter.id,
  });
  return result.sent ? { message: `A test went to ${viewer.email}.` } : { error: `The test could not be sent: ${result.error ?? 'unknown'}.` };
}

/**
 * The letter goes out, once, to every confirmed subscriber.
 *
 * Each send is recorded against the subscriber, so running this twice
 * reaches only those who did not get it the first time. The letter is
 * published at the same moment and appears on /letter for everyone.
 * Sends go one after another; at a hundred a day on the free email
 * plan, a larger list needs the paid plan first.
 */
export async function sendLetterToSubscribers(_prev: LetterResult, formData: FormData): Promise<LetterResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'The demo sends nothing.' };
  if (!emailConfigured()) return { error: 'No email service is connected.' };
  const id = field(formData, 'id') ?? '';
  const letter = await getLetterForEditing(id);
  if (!letter) return { error: 'Save the letter first.' };
  if (!letter.body.trim()) return { error: 'The letter has nothing in it yet.' };

  const db = createAdminClient();
  const [{ data: subs }, { data: already }] = await Promise.all([
    db.from('letter_subscribers').select('id, email, unsubscribe_token').eq('status', 'confirmed'),
    db.from('letter_sends').select('subscriber_id').eq('letter_id', letter.id),
  ]);
  const done = new Set(((already ?? []) as { subscriber_id: string }[]).map((s) => s.subscriber_id));
  const waiting = ((subs ?? []) as { id: string; email: string; unsubscribe_token: string | null }[]).filter((s) => !done.has(s.id));

  const html = renderLetterHtml(letter.body);
  const story = letter.featuredStory ? { title: letter.featuredStory.title, url: `${SITE}/story/${letter.featuredStory.slug}` } : null;
  let sent = 0;
  let failed = 0;
  for (const s of waiting.slice(0, 500)) {
    const result = await sendLetterIssue({
      to: s.email,
      subject: letter.subject || letter.title,
      title: letter.title,
      dek: letter.dek,
      bodyHtml: html,
      bodyText: letter.body,
      story,
      unsubscribeUrl: s.unsubscribe_token ? `${SITE}/letter/unsubscribe?token=${encodeURIComponent(s.unsubscribe_token)}` : null,
      letterId: letter.id,
    });
    if (result.sent) {
      sent += 1;
      await db.from('letter_sends').insert({ letter_id: letter.id, subscriber_id: s.id, provider_message_id: result.messageId ?? null });
    } else {
      failed += 1;
    }
  }

  const now = new Date().toISOString();
  await db
    .from('letters')
    .update({ status: 'published', published_at: letter.publishedAt ?? now, sent_at: now })
    .eq('id', letter.id);
  await db.from('audit_log').insert({ action: 'letter.sent', entity_type: 'letter', entity_id: letter.id, actor_id: viewer.id, actor_email: viewer.email ?? null, after: { sent, failed, waiting: waiting.length } });

  revalidatePath('/letter');
  revalidatePath(`/letter/${letter.slug}`);
  revalidatePath('/admin/letter');
  revalidatePath(`/admin/letter/${letter.id}`);

  if (waiting.length === 0) return { message: 'Everyone subscribed already has this letter. It is published on the site.' };
  return {
    message: `Sent to ${sent} ${sent === 1 ? 'reader' : 'readers'}${failed ? `, ${failed} could not be delivered` : ''}. The letter is published on the site.`,
  };
}

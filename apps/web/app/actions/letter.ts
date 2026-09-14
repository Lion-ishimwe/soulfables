'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { field } from '@/lib/form';
import { getViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendLetterConfirmation, emailConfigured } from '@/lib/email';

export type LetterResult = { error?: string; message?: string };

const schema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  source: z.string().trim().max(40).optional(),
});

/**
 * Joining the weekly letter.
 *
 * Double opt-in when the House can write: the address goes in as
 * pending with a token, and a confirmation email carries the link that
 * turns it confirmed. Until an email provider is connected the address
 * still goes in as pending, and the page says so honestly — the first
 * letter will be preceded by a confirmation, not sent to an unconfirmed
 * list. Nothing here can read the list; the insert goes through the
 * service role because no browser policy is allowed near it.
 */
export async function subscribeToLetter(_prev: LetterResult, formData: FormData): Promise<LetterResult> {
  const parsed = schema.safeParse({ email: field(formData, 'email'), source: field(formData, 'source') });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, source } = parsed.data;

  if (isDemoMode()) return { message: 'The demo keeps no list — but on the real House, you would be on it.' };

  const viewer = await getViewer();
  const db = createAdminClient();

  const { data: existing } = await db
    .from('letter_subscribers')
    .select('id, status')
    .ilike('email', email)
    .maybeSingle();

  if (existing?.status === 'confirmed') {
    return { message: 'You are already on the list. The next letter will find you.' };
  }

  const token = randomBytes(24).toString('hex');
  const row = {
    email,
    user_id: viewer?.id ?? null,
    status: 'pending' as const,
    confirm_token: token,
    token_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    source: source || 'letter',
  };

  const { error } = existing
    ? await db.from('letter_subscribers').update(row).eq('id', existing.id)
    : await db.from('letter_subscribers').insert(row);

  if (error) {
    console.error('[letter] subscribe', error.message);
    return { error: 'The list could not be reached just now. Try again in a moment.' };
  }

  if (emailConfigured()) {
    await sendLetterConfirmation(email, token);
    return { message: 'One more step: a confirmation is on its way to your inbox. Open it and you are in.' };
  }

  return {
    message: 'You are on the list. Before the first letter goes out, we will write once to confirm it is really you.',
  };
}

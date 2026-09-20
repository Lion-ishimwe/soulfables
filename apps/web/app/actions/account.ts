'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { field } from '@/lib/form';
import { requireViewer } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';

export type AccountResult = { error?: string; message?: string };

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'The House needs something to call you.')
    .max(80, 'That is longer than a name needs to be.'),
  bio: z.string().trim().max(2000).optional(),
});

/**
 * Your own name, and your own description of yourself.
 *
 * There was nowhere to do either. /account/settings was a page of links,
 * and the only way to change a display name was to have somebody with a
 * service key do it — including for the founder.
 *
 * Where the biography goes depends on whether you have a byline. An
 * author's bio is public and appears under their stories, so it belongs
 * on the author record; everyone else's sits on their profile, which
 * only they and staff can read. Two different things that happen to
 * share a word.
 */
export async function saveAccountProfile(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  const viewer = await requireViewer();

  const parsed = profileSchema.safeParse({
    displayName: field(formData, 'displayName'),
    bio: field(formData, 'bio'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (isDemoMode()) {
    return {
      error: 'Demo mode keeps nothing. Connect a database and this becomes yours to change.',
    };
  }

  const { displayName, bio } = parsed.data;
  const supabase = await createClient();
  const isAuthor = field(formData, 'isAuthor') === 'true';

  const { error: nameError } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', viewer.id);

  if (nameError) return { error: nameError.message };

  if (isAuthor) {
    // Public byline. The function scopes the write to the caller's own
    // author row and refuses everything else on it.
    const { error } = await supabase.rpc('update_own_author_bio', { p_bio: bio ?? '' });
    if (error) return { error: error.message };
    revalidateTag('content');
  } else {
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio || null })
      .eq('id', viewer.id);
    if (error) return { error: error.message };
  }

  revalidatePath('/', 'layout');

  return { message: 'Saved.' };
}

const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters — length matters more than symbols.')
  .max(200, 'That password is too long.');

/**
 * Change your own password, without leaving the page.
 *
 * Distinct from updatePassword in actions/auth.ts, which redirects — that
 * one is the end of a reset link, where being sent somewhere afterwards
 * is the point. Here you are in the middle of editing your account and
 * should stay there.
 *
 * Supabase requires a current session to change a password, so this
 * cannot be used to take over an account someone left signed in without
 * also knowing... nothing, in fact. That is worth stating plainly rather
 * than implying otherwise: an unlocked, signed-in browser can change the
 * password. The defence is the session, not this form.
 */
export async function changeOwnPassword(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  await requireViewer();

  const password = field(formData, 'password') ?? '';
  const confirm = field(formData, 'confirmPassword') ?? '';

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (password !== confirm) return { error: 'Those two do not match.' };

  if (isDemoMode()) {
    return { error: 'Demo mode has no accounts to change a password on.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };

  return { message: 'Password changed. It takes effect the next time you sign in.' };
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('That does not look like an email address.');

/**
 * Change your own sign-in address.
 *
 * The auth service does the careful part: it emails a link to the new
 * address (and, with secure email change on, to the old one as well) and
 * nothing changes until the link is used. The link lands on /auth/confirm
 * with type=email_change, so a mail scanner opening it early does no
 * harm. Until then you still sign in with the old address.
 */
export async function changeOwnEmail(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  const viewer = await requireViewer();

  const parsed = emailSchema.safeParse(field(formData, 'email'));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;
  if (viewer.email && email === viewer.email.toLowerCase()) {
    return { error: 'That is already your address.' };
  }

  if (isDemoMode()) {
    return { error: 'Demo mode has no accounts to change an address on.' };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/auth/confirm` },
  );
  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return { error: 'That address already belongs to another account.' };
    }
    return { error: error.message };
  }

  return {
    message: `A confirmation link has been sent to ${email}. If a link also arrives at your current address, open both. Nothing changes until then, and you keep signing in with the old address meanwhile.`,
  };
}

/**
 * Leaving the House for good.
 *
 * The account row goes through the service role, because Supabase lets
 * no session delete its own user, and everything keyed to it cascades:
 * journal, shelf, reading history, bookmarks, passages, entitlements.
 * Orders and downloads are keyed with "set null" instead — the receipts
 * stay for the books, with no person attached to them — and that is
 * what the privacy page says. Confirmed by the word typed, not a click.
 */
export async function deleteOwnAccount(
  _prev: AccountResult,
  formData: FormData,
): Promise<AccountResult> {
  const viewer = await requireViewer('/account/settings');
  if ((field(formData, 'confirm') ?? '').trim().toLowerCase() !== 'delete') {
    return { error: 'Type "delete" to confirm. Nothing has been removed.' };
  }
  if (isDemoMode()) return { error: 'The demo has no accounts to delete.' };

  // Staff accounts are not self-service: the House would lose a key.
  if (viewer.role !== 'reader' && viewer.role !== 'author') {
    return { error: 'A staff account is removed by another member of staff, not from here.' };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  // An author record keeps the byline and loses its login, exactly as
  // when the House revokes an account.
  await admin.from('authors').update({ user_id: null }).eq('user_id', viewer.id);

  const { error } = await admin.auth.admin.deleteUser(viewer.id);
  if (error) {
    console.error('[account] delete failed', error.message);
    return { error: 'The account could not be deleted just now. Nothing has changed; try again in a moment.' };
  }

  await admin.from('audit_log').insert({
    action: 'account.deleted_by_owner',
    entity_type: 'user',
    entity_id: viewer.id,
    actor_id: null,
    actor_email: viewer.email,
    after: { self_service: true },
  }).then(() => undefined, () => undefined);

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/goodbye');
}

/**
 * Your own theme, for Premium.
 *
 * The choice is kept for everyone who makes it, but only worn by a
 * Premium reader: the layout asks the plan before it asks the setting,
 * so a reader who stops paying sees the House's palette again without
 * losing what they chose.
 */
export async function saveReaderTheme(_prev: AccountResult, formData: FormData): Promise<AccountResult> {
  const viewer = await requireViewer('/account/settings');
  if (isDemoMode()) return { error: 'Demo mode keeps nothing. Connect a database and this becomes yours to change.' };
  const { canUseSoulAI } = await import('@/lib/ai/access');
  if (!(await canUseSoulAI())) return { error: 'Choosing a theme is part of Premium.' };

  const raw = field(formData, 'theme') ?? '';
  const theme = raw === 'dark' || raw === 'light' || raw === 'sepia' ? raw : null;

  const supabase = await createClient();
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: viewer.id, reader_theme: theme, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return { message: theme ? 'Worn. Every page follows.' : 'Back to the House’s own.' };
}

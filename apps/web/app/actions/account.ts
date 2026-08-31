'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
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

'use server';

import type { Route } from 'next';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getViewer, isStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { DEMO_SIGNED_COOKIE } from '@/lib/demo/session';

/**
 * Auth server actions.
 *
 * Every one of these validates input with Zod before it reaches Supabase,
 * and returns a plain `{ error }` shape rather than throwing — the forms
 * render errors inline, and a thrown error in a server action surfaces as
 * a generic crash page, which tells the reader nothing useful.
 *
 * Note the deliberate ambiguity in `requestPasswordReset`: it returns the
 * same message whether or not the address exists. Anything else turns the
 * reset form into an account-enumeration oracle.
 */

const emailSchema = z.string().trim().toLowerCase().email('That does not look like an email address.');

const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters — length matters more than symbols.')
  .max(200, 'That password is too long.');

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
  next: z.string().optional(),
});

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, 'What should the House call you?').max(80),
});

export type ActionResult = { error?: string; message?: string };

/**
 * Where to send someone once they are through the door.
 *
 * An explicit `next` always wins — it is how "sign in to keep this story"
 * returns you to the story you were reading. Only the default is
 * role-aware: staff go to the admin, because that is what they came for,
 * and readers go to their shelf.
 *
 * The cast is safe precisely because of the checks here. An open redirect
 * would let a phishing link bounce a freshly-authenticated reader off to
 * another domain, which is why anything not starting with a single slash
 * is discarded rather than trusted.
 */
async function landingFor(next: unknown): Promise<Route> {
  if (
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//')
  ) {
    return next as Route;
  }

  const viewer = await getViewer();
  return (viewer && isStaff(viewer.role)
    ? '/admin'
    : '/account/library') as Route;
}

async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function signIn(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: field(formData, 'email'),
    password: field(formData, 'password'),
    next: field(formData, 'next'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Demo mode has no accounts. Any well-formed email opens the House, so
  // an evaluator can see the signed-in surfaces. Unreachable in live
  // mode: isDemoMode() requires the absence of Supabase credentials.
  if (isDemoMode()) {
    const store = await cookies();
    store.set(DEMO_SIGNED_COOKIE, '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    revalidatePath('/', 'layout');
    redirect(await landingFor(parsed.data.next));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Do not distinguish "no such account" from "wrong password".
    return { error: 'That email and password do not match. Try again.' };
  }

  revalidatePath('/', 'layout');
  redirect(await landingFor(parsed.data.next));
}

export async function signUp(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: field(formData, 'email'),
    password: field(formData, 'password'),
    displayName: field(formData, 'displayName'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // Read by the handle_new_user() trigger to seed the profile.
      data: { display_name: parsed.data.displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    message:
      'Check your email. There is a link waiting that opens the door.',
  };
}

export async function requestPasswordReset(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(field(formData, 'email'));

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();

  // Result deliberately ignored: revealing whether the address exists
  // would let anyone test which emails have Soulfables accounts.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
  });

  return {
    message:
      'If that address has an account, a reset link is on its way.',
  };
}

export async function updatePassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(field(formData, 'password'));

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  redirect('/account/library' as Route);
}

export async function signOut(): Promise<void> {
  if (isDemoMode()) {
    const store = await cookies();
    store.delete(DEMO_SIGNED_COOKIE);
    revalidatePath('/', 'layout');
    redirect('/');
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

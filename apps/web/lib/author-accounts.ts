import 'server-only';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import { createClient } from './supabase/server';
import { isDemoMode } from './demo/mode';

/**
 * Giving a writer a way in, for real.
 *
 * Until now this only ever wrote to the demo store, so in live mode the
 * button reported success and created nothing. Three things have to
 * happen together, and none of them can be done by the reader's own
 * session:
 *
 *   1. an account in auth.users
 *   2. authors.user_id pointing at it, which is what makes the byline
 *      and the login the same person
 *   3. a notification, so the writer arrives to something rather than to
 *      an empty room
 *
 * All three need the service role, which bypasses RLS — so this file is
 * one of the four places allowed to use it, and every path through it
 * checks staff first at the call site.
 */

export type Provisioned =
  | { ok: true; password: string; userId: string }
  | { ok: false; error: string };

/**
 * Readable, and long enough that its readability costs nothing.
 *
 * The writer will paste this once and then change it. Ambiguous glyphs
 * are left out because this password gets read aloud and typed by hand
 * more often than a password should.
 */
function temporaryPassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(20), (b) => alphabet[b % alphabet.length]).join('');
}

export async function provisionAuthorAccount(opts: {
  authorSlug: string;
  email: string;
  invitedBy: string | null;
  displayName: string;
}): Promise<Provisioned> {
  const admin = createAdminClient();
  const password = temporaryPassword();

  /*
   * email_confirm bypasses the verification click. The address was typed
   * by a member of staff who is vouching for it, and there is no email
   * provider connected yet — waiting for a link nobody can send would
   * leave the account unusable.
   */
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: opts.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: opts.displayName },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? 'The account could not be created.';
    return {
      ok: false,
      error: /already been registered|already exists/i.test(message)
        ? 'Somebody already has an account with that address.'
        : message,
    };
  }

  const userId = created.user.id;

  const { error: linkError } = await admin
    .from('authors')
    .update({ user_id: userId, invited_at: new Date().toISOString(), invited_by: opts.invitedBy })
    .eq('slug', opts.authorSlug);

  if (linkError) {
    /*
     * The account exists but is attached to nobody, which is worse than
     * either state on its own — the writer could sign in and the House
     * would not know who they were. Undo it.
     */
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: 'The account was created but could not be linked, so it was removed.' };
  }

  // Best effort. An author who arrives without a greeting still has an
  // account, so this must not be allowed to fail the whole operation.
  await admin.from('notifications').insert({
    user_id: userId,
    kind: 'account.created',
    title: 'Welcome to the writing room',
    body: 'You have an account. Anything you write comes to the House before it goes out.',
    href: '/studio',
  });

  return { ok: true, password, userId };
}

/** Remove the login, keep the byline and everything published under it. */
export async function revokeAccountFor(authorSlug: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { data: author } = await admin
    .from('authors')
    .select('user_id')
    .eq('slug', authorSlug)
    .single();

  if (!author?.user_id) return { ok: false, error: 'That author has no account to revoke.' };

  await admin.from('authors').update({ user_id: null, invited_at: null }).eq('slug', authorSlug);

  const { error } = await admin.auth.admin.deleteUser(author.user_id as string);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * The signed-in author's own record, for the writing room.
 *
 * Returns null for anyone who is not an author — staff who write under a
 * House voice, or a reader who wandered in. The caller renders nothing
 * rather than an empty editor.
 */
export async function myAuthor(): Promise<{
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
} | null> {
  if (isDemoMode()) {
    const [{ currentDemoPersona }, { demoListAuthors }] = await Promise.all([
      import('./demo/session'),
      import('./demo/editorial'),
    ]);
    const persona = await currentDemoPersona();
    if (!persona) return null;

    const author = demoListAuthors().find(
      (a) => !a.isPersona && a.name === persona.displayName,
    );
    return author
      ? { slug: author.slug, name: author.name, bio: author.bio, avatarUrl: author.avatarUrl }
      : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('my_author');
  if (error || !data?.length) return null;

  const row = data[0] as Record<string, string | null>;
  return {
    slug: row.slug as string,
    name: row.name as string,
    bio: row.bio,
    avatarUrl: row.avatar_url,
  };
}

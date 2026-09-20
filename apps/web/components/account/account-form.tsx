'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import {
  saveAccountProfile,
  changeOwnPassword,
  changeOwnEmail,
  type AccountResult,
} from '@/app/actions/account';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-gold px-6 py-2.5 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? busy : label}
    </button>
  );
}

/**
 * Say what happened, where it will be seen.
 *
 * This cost somebody an evening. The message rendered correctly and was
 * missed, because it sits above the fields — so on a short viewport you
 * press the button at the bottom, the answer appears off-screen above,
 * and nothing appears to happen. A password that silently refused to
 * change looks identical to one that silently changed.
 *
 * Scrolling it into view is the whole fix. The clearing of the password
 * fields on success is the other half: an emptied form is a second, wordless
 * signal that something happened.
 */
function Notice({ state }: { state: AccountResult }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error || state.message) {
      ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [state.error, state.message]);

  if (state.error) {
    return (
      <p
        ref={ref}
        role="alert"
        className="mb-5 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
      >
        {state.error}
      </p>
    );
  }
  if (state.message) {
    return (
      <p
        ref={ref}
        aria-live="polite"
        className="mb-5 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory"
      >
        {state.message}
      </p>
    );
  }
  return null;
}

const FIELD =
  'w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';
const LABEL = 'mb-2 block font-ui text-sm text-ivory';
const HINT = 'mt-2 font-ui text-xs text-grey-muted';

/**
 * Your account: what you are called, what you say about yourself, and the
 * password that gets you in.
 *
 * One component, mounted twice — inside the admin for staff and authors,
 * and on /account/settings for readers. The alternative was two forms
 * doing the same three things, which is two places to fix the next time
 * one of them is wrong.
 *
 * Two separate forms rather than one, deliberately. Changing a name and
 * changing a password fail for different reasons and succeed at
 * different moments, and a single Save that reports "saved" while the
 * password half quietly failed would be worse than either.
 */
export function AccountForm({
  displayName,
  bio,
  email,
  isAuthor,
  authorSlug,
}: {
  displayName: string;
  bio: string | null;
  email: string | null;
  isAuthor: boolean;
  authorSlug?: string | null;
}) {
  const [profileState, profileAction] = useActionState<AccountResult, FormData>(
    saveAccountProfile,
    {},
  );
  const [passwordState, passwordAction] = useActionState<AccountResult, FormData>(
    changeOwnPassword,
    {},
  );
  const [emailState, emailAction] = useActionState<AccountResult, FormData>(
    changeOwnEmail,
    {},
  );

  // Emptied on success, so the form does not sit there still holding the
  // password it has already accepted.
  const passwordForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (passwordState.message) passwordForm.current?.reset();
  }, [passwordState.message]);

  return (
    <div className="space-y-6">
      {/* ---- Who you are ------------------------------------------- */}
      <form action={profileAction} className="rounded-lg border border-rule bg-ink-raised">
        <header className="border-b border-rule px-5 py-4">
          <h2 className="font-ui text-sm text-ivory">You</h2>
          <p className="mt-0.5 font-ui text-micro text-grey-faint">
            {isAuthor
              ? 'Your name and biography appear under every story you write.'
              : 'What the House calls you.'}
          </p>
        </header>

        <div className="p-5">
          <Notice state={profileState} />
          <input type="hidden" name="isAuthor" value={String(isAuthor)} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="acct-name" className={LABEL}>
                Name
              </label>
              <input
                id="acct-name"
                name="displayName"
                required
                maxLength={80}
                defaultValue={displayName}
                className={FIELD}
              />
              <p className={HINT}>
                {isAuthor ? 'Your byline, as readers see it.' : 'Shown when you are signed in.'}
              </p>
            </div>

            <div>
              <label htmlFor="acct-email" className={LABEL}>
                Email
              </label>
              {/*
                Shown here, changed below. The email is the account, so a
                change goes through a confirmation link rather than a save
                button; the Email section under this form does that.
              */}
              <input
                id="acct-email"
                value={email ?? '—'}
                readOnly
                disabled
                className={`${FIELD} cursor-not-allowed opacity-60`}
              />
              <p className={HINT}>
                How you sign in. To change it, use the Email section below.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="acct-bio" className={LABEL}>
              Biography
            </label>
            <textarea
              id="acct-bio"
              name="bio"
              rows={5}
              maxLength={2000}
              defaultValue={bio ?? ''}
              placeholder={
                isAuthor
                  ? 'A few sentences. What you write about, and why.'
                  : 'Optional. Only you and the House can see this.'
              }
              className={`${FIELD} resize-y font-reading text-base leading-relaxed`}
            />
            <p className={HINT}>
              {isAuthor ? (
                <>
                  Public. Shown on your story pages
                  {authorSlug ? ` and at /author/${authorSlug}` : ''}.
                </>
              ) : (
                'Private. Not shown to readers.'
              )}
            </p>
          </div>

          <div className="mt-6 flex justify-end border-t border-rule pt-5">
            <Submit label="Save" busy="Saving…" />
          </div>
        </div>
      </form>

      {/* ---- Password ---------------------------------------------- */}
      {/* ---- Email --------------------------------------------------- */}
      <form action={emailAction} className="rounded-lg border border-rule bg-ink-raised">
        <header className="border-b border-rule px-5 py-4">
          <h2 className="font-ui text-sm text-ivory">Email</h2>
          <p className="mt-0.5 font-ui text-micro text-grey-faint">
            A confirmation link goes to the new address. Nothing changes until it is opened.
          </p>
        </header>

        <div className="p-5">
          <Notice state={emailState} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="acct-new-email" className={LABEL}>
                New email
              </label>
              <input
                id="acct-new-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={email ?? ''}
                className={FIELD}
              />
              <p className={HINT}>
                You keep signing in with {email ?? 'the current address'} until the link is used.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-rule pt-5">
            <Submit label="Send confirmation" busy="Sending…" />
          </div>
        </div>
      </form>

      {/* ---- Password ------------------------------------------------ */}
      <form ref={passwordForm} action={passwordAction} className="rounded-lg border border-rule bg-ink-raised">
        <header className="border-b border-rule px-5 py-4">
          <h2 className="font-ui text-sm text-ivory">Password</h2>
          <p className="mt-0.5 font-ui text-micro text-grey-faint">
            Ten characters or more. Length does more than symbols.
          </p>
        </header>

        <div className="p-5">
          <Notice state={passwordState} />

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="acct-pw" className={LABEL}>
                New password
              </label>
              <input
                id="acct-pw"
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={FIELD}
              />
            </div>

            <div>
              <label htmlFor="acct-pw2" className={LABEL}>
                Again
              </label>
              <input
                id="acct-pw2"
                name="confirmPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={FIELD}
              />
              <p className={HINT}>Both must match before anything is changed.</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-rule pt-5">
            <Submit label="Change password" busy="Changing…" />
          </div>
        </div>
      </form>
    </div>
  );
}

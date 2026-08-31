'use client';

import { useState } from 'react';
import { AccountForm } from '@/components/account/account-form';

/**
 * The writing room's account section, collapsed by default.
 *
 * Nobody opens the Writing Room to change their password — they open it
 * to write. An expanded form at the top of the page would say otherwise,
 * so it sits behind one line that shows the current state and a link to
 * change it.
 */
export function AccountPanel({
  displayName,
  bio,
  email,
  authorSlug,
}: {
  displayName: string;
  bio: string | null;
  email: string | null;
  authorSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-12">
      <div className="flex flex-wrap items-start justify-between gap-4 border border-rule px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-ui text-sm text-ivory">How readers see you</h2>
          <p className="mt-1 max-w-prose font-ui text-sm leading-relaxed text-grey-muted">
            {bio ?? `Nothing yet — your stories carry just the name ${displayName}.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 font-ui text-xs text-gold transition-colors hover:text-gold-soft"
        >
          {open ? 'Close' : 'Your account'}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <AccountForm
            displayName={displayName}
            bio={bio}
            email={email}
            isAuthor
            authorSlug={authorSlug}
          />
        </div>
      )}
    </section>
  );
}

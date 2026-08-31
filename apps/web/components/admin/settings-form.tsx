'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveHouseSettings, type SettingsResult } from '@/app/actions/settings';
import type { HouseSettings } from '@/lib/settings';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-gold px-6 py-2.5 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  );
}

/**
 * The editable half of Settings.
 *
 * Everything here was previously typed into the pages that display it —
 * the support addresses in two separate files, both on the wrong domain.
 * A field is worth having when the alternative is a value maintained in
 * several places, and worth refusing when it is not.
 */
export function SettingsForm({ settings }: { settings: HouseSettings }) {
  const [state, formAction] = useActionState<SettingsResult, FormData>(
    saveHouseSettings,
    {},
  );

  const field =
    'w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';
  const label = 'mb-2 block font-ui text-sm text-ivory';
  const hint = 'mt-2 font-ui text-xs text-grey-muted';

  return (
    <form action={formAction} className="rounded-lg border border-rule bg-ink-raised">
      <header className="border-b border-rule px-5 py-4">
        <h2 className="font-ui text-sm text-ivory">The House</h2>
        <p className="mt-0.5 font-ui text-micro text-grey-faint">
          What Soulfables says about itself, wherever it says it.
        </p>
      </header>

      <div className="p-5">
        {state.error && (
          <p
            role="alert"
            className="mb-5 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
          >
            {state.error}
          </p>
        )}
        {state.message && (
          <p
            aria-live="polite"
            className="mb-5 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory"
          >
            {state.message}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="s-name" className={label}>
              Name
            </label>
            <input
              id="s-name"
              name="siteName"
              required
              maxLength={80}
              defaultValue={settings.siteName}
              className={field}
            />
            <p className={hint}>Shown in the header, the title bar and every email.</p>
          </div>

          <div>
            <label htmlFor="s-tagline" className={label}>
              Tagline
            </label>
            <input
              id="s-tagline"
              name="tagline"
              maxLength={160}
              defaultValue={settings.tagline}
              className={field}
            />
            <p className={hint}>The line under the name. Six words is plenty.</p>
          </div>

          <div>
            <label htmlFor="s-general" className={label}>
              General enquiries
            </label>
            <input
              id="s-general"
              name="supportEmailGeneral"
              type="email"
              required
              defaultValue={settings.supportEmailGeneral}
              className={field}
            />
            <p className={hint}>
              Questions about the House, the writing, the letter.
            </p>
          </div>

          <div>
            <label htmlFor="s-shop" className={label}>
              Shop support
            </label>
            <input
              id="s-shop"
              name="supportEmailShop"
              type="email"
              required
              defaultValue={settings.supportEmailShop}
              className={field}
            />
            <p className={hint}>
              Orders, downloads, residency. Read by whoever handles money.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="s-url" className={label}>
            Site address
          </label>
          <input
            id="s-url"
            name="siteUrl"
            type="url"
            placeholder="https://soulfables.co"
            defaultValue={settings.siteUrl ?? ''}
            className={field}
          />
          <p className={hint}>
            Used for canonical links and anything emailed out. Include https://
          </p>
        </div>

        <div className="mt-6 flex justify-end border-t border-rule pt-5">
          <Save />
        </div>
      </div>
    </form>
  );
}

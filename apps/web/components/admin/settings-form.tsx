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

        {/*
          Who the House is on paper. A receipt has to say who took the
          money and a privacy page has to name the controller; until the
          entity is registered these stay empty and the House signs as
          itself.
        */}
        <fieldset className="mt-6 border-t border-rule pt-5">
          <legend className="sr-only">The business</legend>
          <p className={label}>The business, on paper</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="s-legal-name" className="sf-eyebrow mb-2 block">Registered name</label>
              <input id="s-legal-name" name="legalName" maxLength={200} defaultValue={settings.legalName ?? ''} placeholder="Soulfables OÜ" className={field} />
              <p className={hint}>On receipts and the privacy page. Empty means “Soulfables”.</p>
            </div>
            <div>
              <label htmlFor="s-vat" className="sf-eyebrow mb-2 block">VAT number</label>
              <input id="s-vat" name="vatNumber" maxLength={40} defaultValue={settings.vatNumber ?? ''} placeholder="EE123456789" className={field} />
              <p className={hint}>Shown on receipts when set.</p>
            </div>
          </div>
          <div className="mt-5">
            <label htmlFor="s-address" className="sf-eyebrow mb-2 block">Registered address</label>
            <textarea id="s-address" name="legalAddress" rows={3} maxLength={600} defaultValue={settings.legalAddress ?? ''} className={`${field} resize-y`} />
            <p className={hint}>One line per line, as it should print.</p>
          </div>
        </fieldset>

        {/*
          One switch, everyone. A theme that each person could set for
          themselves would be a preference; this is the House deciding
          what it looks like, which is why it lives here and not under
          Account.
        */}
        <fieldset className="mt-6 border-t border-rule pt-5">
          <legend className="sr-only">Appearance</legend>
          <p className={label}>Appearance</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { value: 'dark', title: 'Night', note: 'Deep black, warm ivory, lamp-lit gold. The House as it was built.' },
                { value: 'light', title: 'Day', note: 'Ivory paper, near-black text, the same gold a shade deeper.' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-3 rounded border border-rule bg-ink px-4 py-3.5 transition-colors has-[:checked]:border-gold/60 has-[:checked]:bg-gold-dim"
              >
                <input
                  type="radio"
                  name="theme"
                  value={opt.value}
                  defaultChecked={settings.theme === opt.value}
                  className="mt-1 h-3.5 w-3.5 flex-none accent-[#C89528]"
                />
                <span className="min-w-0">
                  <span className="block font-ui text-sm text-ivory">{opt.title}</span>
                  <span className="mt-0.5 block font-ui text-xs leading-relaxed text-grey-muted">{opt.note}</span>
                </span>
              </label>
            ))}
          </div>
          <p className={hint}>
            Applies to the whole site, for everyone — readers, writers and this admin. Dark is the default.
          </p>
        </fieldset>

        {/*
          The voice. On by default: a story is read aloud when it is
          published and again when its words change; a recording by a
          person is never replaced. Off, and narration is only ever
          asked for from a story's own page.
        */}
        <fieldset className="mt-6 border-t border-rule pt-5">
          <legend className="sr-only">Narration</legend>
          <p className={label}>Narration</p>
          <label className="flex items-start gap-3 rounded border border-rule bg-ink px-4 py-3.5">
            <input
              type="checkbox"
              name="autoNarration"
              defaultChecked={settings.autoNarration}
              className="mt-1 h-3.5 w-3.5 flex-none accent-[#C89528]"
            />
            <span className="min-w-0">
              <span className="block font-ui text-sm text-ivory">Read every published story aloud</span>
              <span className="mt-0.5 block font-ui text-xs leading-relaxed text-grey-muted">
                A generated voice reads a story when it is published, and again when its words change.
                A recording by a person is never replaced. About ten cents a story.
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-6 flex justify-end border-t border-rule pt-5">
          <Save />
        </div>
      </div>
    </form>
  );
}

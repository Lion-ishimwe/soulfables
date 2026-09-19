'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveReaderTheme, type AccountResult } from '@/app/actions/account';

const THEMES = [
  { value: '', label: 'The House’s', hint: 'Whatever the House is wearing' },
  { value: 'dark', label: 'Night', hint: 'Ink and gold' },
  { value: 'light', label: 'Day', hint: 'Paper and near-black' },
  { value: 'sepia', label: 'Lamplight', hint: 'Warm paper, for long reads' },
] as const;

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Wear it'}
    </button>
  );
}

/** Your own palette, for Premium. Free readers see what it is and where it lives. */
export function ThemeChooser({ current, allowed }: { current: string | null; allowed: boolean }) {
  const [state, formAction] = useActionState<AccountResult, FormData>(saveReaderTheme, {});

  return (
    <section className="mb-10 border border-rule p-6">
      <h2 className="sf-eyebrow">Your theme</h2>
      <p className="mt-2 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
        {allowed
          ? 'The palette every page wears for you, whatever the House is wearing for everyone else.'
          : 'Premium readers choose the palette every page wears for them. Free readers see the House’s.'}
      </p>
      {allowed ? (
        <form action={formAction} className="mt-5">
          <div className="grid gap-px bg-rule sm:grid-cols-4">
            {THEMES.map((t) => (
              <label key={t.value} className="flex cursor-pointer flex-col gap-1 bg-ink p-4 transition-colors hover:bg-ink-raised">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    value={t.value}
                    defaultChecked={(current ?? '') === t.value}
                    className="h-3.5 w-3.5 accent-[#C89528]"
                  />
                  <span className="font-display text-lg text-ivory">{t.label}</span>
                </span>
                <span className="font-ui text-xs text-grey-muted">{t.hint}</span>
              </label>
            ))}
          </div>
          {state.error && (
            <p role="alert" className="mt-3 text-sm text-state-danger">
              {state.error}
            </p>
          )}
          {state.message && (
            <p aria-live="polite" className="mt-3 text-sm text-gold">
              {state.message}
            </p>
          )}
          <div className="mt-4">
            <Save />
          </div>
        </form>
      ) : (
        <Link
          href={'/membership' as Route}
          className="mt-4 inline-block border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          See Premium
        </Link>
      )}
    </section>
  );
}

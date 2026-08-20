'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/app/actions/auth';

/**
 * Shared chrome for every auth screen, so signing in, joining, and
 * resetting a password all feel like the same door rather than three
 * different forms bolted onto the House.
 */

export function AuthShell({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-md px-5 py-24 sm:py-32">
      <div className="text-center">
        <p className="text-gold" aria-hidden="true">
          ✦
        </p>
        <p className="sf-eyebrow mt-5">{eyebrow}</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 text-sm leading-normal text-grey-muted">{intro}</p>
        )}
      </div>

      <div className="mt-10">{children}</div>

      {footer && (
        <div className="mt-8 border-t border-rule pt-6 text-center text-sm text-grey-muted">
          {footer}
        </div>
      )}
    </section>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  autoComplete,
  required = true,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  const id = `field-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="sf-eyebrow mb-2 block">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full border border-rule bg-ink-raised px-4 py-3 font-ui text-base text-ivory outline-none transition-colors duration-base ease-house placeholder:text-grey-faint focus:border-gold/50"
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-xs text-grey-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full border border-gold/50 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Wraps a form around a server action and renders its result. Errors are
 * announced politely rather than assertively — a failed sign-in is not an
 * emergency, and a screen reader interrupting mid-word is worse than a
 * beat of delay.
 */
export function ActionForm({
  action,
  children,
  hiddenFields,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, {});

  return (
    <form action={formAction} noValidate>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      {state.error && (
        <p
          role="alert"
          aria-live="polite"
          className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}

      {state.message && (
        <p
          aria-live="polite"
          className="mb-5 border-l-2 border-gold bg-gold-dim px-4 py-3 text-sm text-ivory"
        >
          {state.message}
        </p>
      )}

      {children}
    </form>
  );
}

export function AuthLink({ href, children }: { href: '/signin' | '/signup' | '/reset-password'; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-gold transition-colors duration-base ease-house hover:text-gold-soft"
    >
      {children}
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { changePlan, type PlanResult } from '@/app/actions/membership';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full border border-gold/50 px-6 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'One moment…' : label}
    </button>
  );
}

export function PlanSwitcher({
  target,
  current,
  signedIn,
}: {
  target: 'free' | 'resident';
  current: 'free' | 'resident';
  signedIn: boolean;
}) {
  const [state, formAction] = useActionState<PlanResult, FormData>(changePlan, {});

  if (!signedIn) {
    return (
      <Link
        href="/signin?next=/membership"
        className="block w-full border border-rule px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Sign in first
      </Link>
    );
  }

  if (current === target) {
    return (
      <p className="border border-rule px-6 py-3 text-center font-ui text-xs uppercase tracking-[0.18em] text-grey-muted">
        Your current tier
      </p>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={target} />
      {state.error && (
        <p role="alert" className="mb-3 text-sm text-state-danger">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mb-3 text-sm text-gold">
          {state.message}
        </p>
      )}
      <Submit label={target === 'resident' ? 'Become a Resident' : 'Return to Reader'} />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveMembership, type SettingsResult } from '@/app/actions/settings';
import { Field } from '@/components/admin/ui';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : 'Save'}
    </button>
  );
}

export function MembershipForm({
  pricing,
  readOnly,
}: {
  pricing: {
    monthlyMajor: string;
    yearlyMajor: string;
    currency: string;
    monthlyPlanId: string;
    yearlyPlanId: string;
    freeAudioPerMonth: number;
  };
  readOnly: boolean;
}) {
  const [state, formAction] = useActionState<SettingsResult, FormData>(saveMembership, {});

  return (
    <form action={formAction} className="border border-rule p-6">
      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mb-5 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          {state.message}
        </p>
      )}

      <p className="sf-eyebrow mb-5">Premium, priced</p>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field
          label={`A month (${pricing.currency})`}
          name="monthly"
          type="number"
          defaultValue={pricing.monthlyMajor}
          hint="Including VAT. What the membership page shows."
        />
        <Field
          label={`A year (${pricing.currency})`}
          name="yearly"
          type="number"
          defaultValue={pricing.yearlyMajor}
          hint="Including VAT. The page works out the saving itself."
        />
      </div>

      <p className="sf-eyebrow mb-5 mt-2">PayPal plans</p>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field
          label="Monthly plan id"
          name="monthlyPlanId"
          defaultValue={pricing.monthlyPlanId}
          placeholder="P-…"
          hint="From PayPal → Products → your plan. Premium is not on sale until this is filled in."
        />
        <Field
          label="Yearly plan id"
          name="yearlyPlanId"
          defaultValue={pricing.yearlyPlanId}
          placeholder="P-…"
          hint="Optional. Without it, only monthly is offered."
        />
      </div>

      <p className="sf-eyebrow mb-5 mt-2">Free</p>
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field
          label="Narrated stories a month"
          name="freeAudioPerMonth"
          type="number"
          defaultValue={pricing.freeAudioPerMonth}
          hint="How many different stories a Free reader may listen to in a calendar month."
        />
      </div>

      <div className="mt-2 flex items-center gap-4">
        {readOnly ? <p className="font-ui text-xs text-grey-muted">The demo keeps its prices as they are.</p> : <Save />}
      </div>
    </form>
  );
}

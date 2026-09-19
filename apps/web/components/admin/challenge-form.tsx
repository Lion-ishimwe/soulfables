'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveChallenge, type CommunityResult } from '@/app/actions/community';
import { Field, TextArea } from '@/components/admin/ui';
import type { Challenge } from '@/lib/community';

function Save({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50">
      {pending ? 'Saving…' : editing ? 'Save the challenge' : 'Set the challenge'}
    </button>
  );
}

/** A challenge: a prompt with dates. Responses are posts that name it. */
export function ChallengeForm({ challenge, readOnly }: { challenge: Challenge | null; readOnly: boolean }) {
  const [state, formAction] = useActionState<CommunityResult, FormData>(saveChallenge, {});
  const today = new Date().toISOString().slice(0, 10);
  const inThree = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  return (
    <form action={formAction} className="border border-rule p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="sf-eyebrow">{challenge ? `Editing “${challenge.title}”` : 'A new challenge'}</p>
        {challenge && (
          <Link href={'/admin/community' as Route} className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory">Cancel</Link>
        )}
      </div>
      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">{state.error}</p>
      )}
      {challenge && <input type="hidden" name="originalSlug" value={challenge.slug} />}
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field label="Title" name="title" required defaultValue={challenge?.title} />
        <Field label="Web address" name="slug" required defaultValue={challenge?.slug} hint="Lowercase, hyphens." />
      </div>
      <TextArea label="The prompt" name="prompt" rows={3} defaultValue={challenge?.prompt} placeholder="Write about one object you kept after a season ended…" />
      <div className="grid gap-x-6 sm:grid-cols-3">
        <Field label="Begins" name="startsOn" type="date" defaultValue={challenge?.startsOn ?? today} />
        <Field label="Ends" name="endsOn" type="date" defaultValue={challenge?.endsOn ?? inThree} />
        <label className="mb-5 flex items-start gap-3 self-end rounded border border-rule bg-ink px-4 py-3">
          <input type="checkbox" name="isActive" value="1" defaultChecked={challenge?.isActive ?? true} className="mt-1 h-3.5 w-3.5 accent-[#C89528]" />
          <span className="font-ui text-sm text-ivory">On the wall while its dates run</span>
        </label>
      </div>
      <div className="mt-2">
        {readOnly ? <p className="font-ui text-xs text-grey-muted">The demo keeps its challenge as it is.</p> : <Save editing={Boolean(challenge)} />}
      </div>
    </form>
  );
}

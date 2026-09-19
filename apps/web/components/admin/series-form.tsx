'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveSeries, type EditorialResult } from '@/app/actions/editorial';
import { Field, TextArea, Select } from '@/components/admin/ui';
import type { Series } from '@/lib/series';

function Save({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : editing ? 'Save the series' : 'Create the series'}
    </button>
  );
}

/** One series, written or rewritten. Episodes are assigned from each story's own page. */
export function SeriesForm({ series, readOnly }: { series: Series | null; readOnly: boolean }) {
  const [state, formAction] = useActionState<EditorialResult, FormData>(saveSeries, {});
  return (
    <form action={formAction} className="border border-rule p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="sf-eyebrow">{series ? `Editing “${series.title}”` : 'A new series'}</p>
        {series && (
          <Link href={'/admin/series' as Route} className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory">
            Cancel
          </Link>
        )}
      </div>
      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}
      {series && <input type="hidden" name="originalSlug" value={series.slug} />}
      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field label="Title" name="title" required defaultValue={series?.title} />
        <Field label="Web address" name="slug" required defaultValue={series?.slug} hint="Lowercase, hyphens. /series/this" />
      </div>
      <TextArea label="Description" name="description" rows={3} defaultValue={series?.description} />
      <div className="grid gap-x-6 sm:grid-cols-3">
        <Select
          label="Access"
          name="access"
          defaultValue={series?.access ?? 'free'}
          options={[
            { value: 'free', label: 'Free to everyone' },
            { value: 'premium', label: 'Premium only — every episode' },
          ]}
          hint="Premium here overrides the episodes’ own setting."
        />
        <Select
          label="Status"
          name="status"
          defaultValue={series?.status ?? 'draft'}
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'published', label: 'Published' },
            { value: 'archived', label: 'Archived' },
          ]}
        />
        <Field label="Order" name="sortOrder" type="number" defaultValue={series?.sortOrder ?? 0} hint="On the series page." />
      </div>
      <div className="mt-2">
        {readOnly ? <p className="font-ui text-xs text-grey-muted">The demo has no series to change.</p> : <Save editing={Boolean(series)} />}
      </div>
    </form>
  );
}

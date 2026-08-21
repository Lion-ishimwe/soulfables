import Link from 'next/link';
import type { Route } from 'next';

/** Shared admin primitives. A tool is scanned and operated, not read. */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { href: Route; label: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-6">
      <div>
        <h1 className="font-display text-3xl font-light text-ivory">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm leading-normal text-grey-muted">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  published: 'border-state-success/45 text-state-success',
  scheduled: 'border-gold/45 text-gold',
  in_review: 'border-gold/45 text-gold',
  draft: 'border-rule-strong text-grey-muted',
  archived: 'border-rule-strong text-grey-muted',
  paid: 'border-state-success/45 text-state-success',
  pending: 'border-gold/45 text-gold',
  failed: 'border-state-danger/45 text-state-danger',
  refunded: 'border-state-danger/45 text-state-danger',
};

/** State encoded in form as well as text, so a list scans at a glance. */
export function StatusPill({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'border-rule-strong text-grey-muted';
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${cls}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { href: Route; label: string };
}) {
  return (
    <div className="border border-rule px-8 py-16 text-center">
      <p className="font-display text-2xl text-ivory">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-normal text-grey-muted">
        {body}
      </p>
      {action && (
        <Link
          href={action.href}
          className="mt-6 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Shown when Supabase credentials are absent — during design work, or if
 * an environment is misconfigured. Says exactly what is wrong and what to
 * do about it, rather than rendering an empty table that looks like real
 * data.
 */
export function NotConnected() {
  return (
    <div className="border-l-2 border-state-danger bg-state-danger/10 px-6 py-5">
      <p className="font-ui text-sm font-semibold text-ivory">
        No database connection
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-normal text-grey">
        This environment has no Supabase credentials, so nothing can be read
        or written. Set <code className="text-gold">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
        <code className="text-gold">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{' '}
        <code className="text-gold">SUPABASE_SERVICE_ROLE_KEY</code> in{' '}
        <code className="text-gold">.env.local</code>, then restart. See{' '}
        <code className="text-gold">documentation/local-development.md</code>.
      </p>
    </div>
  );
}

/**
 * Demo mode: the admin is fully browsable but nothing saves. Saying so
 * up front is the whole point — an editor that silently discards an edit
 * is worse than one that refuses.
 */
export function ReadOnlyNotice() {
  return (
    <div className="mb-8 border-l-2 border-gold bg-gold-dim px-6 py-4">
      <p className="font-ui text-sm font-semibold text-ivory">
        Browsable, but nothing saves
      </p>
      <p className="mt-1.5 max-w-2xl text-sm leading-normal text-grey">
        This is the real admin against sample content. Every screen and
        control is what ships; writing needs the database, which is the
        next milestone.
      </p>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-rule p-6">
      <p className="sf-eyebrow">{label}</p>
      <p className="mt-3 font-display text-4xl font-light tabular-nums text-ivory">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-grey-muted">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  name,
  hint,
  defaultValue,
  required,
  placeholder,
  type = 'text',
}: {
  label: string;
  name: string;
  hint?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="sf-eyebrow mb-2 block">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={hint ? `${id}-h` : undefined}
        className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
      />
      {hint && (
        <p id={`${id}-h`} className="mt-1.5 text-xs text-grey-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  name,
  rows = 6,
  hint,
  defaultValue,
  mono,
  placeholder,
}: {
  label: string;
  name: string;
  rows?: number;
  hint?: string;
  defaultValue?: string | null;
  mono?: boolean;
  placeholder?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="sf-eyebrow mb-2 block">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={hint ? `${id}-h` : undefined}
        className={`w-full resize-y border border-rule bg-ink-raised px-3.5 py-2.5 text-sm text-ivory outline-none transition-colors focus:border-gold/50 ${
          mono ? 'font-mono leading-relaxed' : 'font-ui'
        }`}
      />
      {hint && (
        <p id={`${id}-h`} className="mt-1.5 text-xs text-grey-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function Select({
  label,
  name,
  options,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="sf-eyebrow mb-2 block">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink">
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-grey-muted">{hint}</p>}
    </div>
  );
}

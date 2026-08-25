'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type ActionResult } from '@/app/actions/auth';
import type { DemoPersona } from '@/lib/demo/session';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  author: 'Author',
  reader: 'Reader',
};

function Enter({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Opening…' : `Come in as ${name}`}
    </button>
  );
}

/**
 * Three doors into the same House.
 *
 * Each is a real sign-in through the same action a typed address uses —
 * not a shortcut around it — so what you see afterwards is the product,
 * not a preview of it.
 */
export function PersonaPicker({
  personas,
  next,
}: {
  personas: DemoPersona[];
  next?: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(signIn, {});

  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}

      <ul className="space-y-4">
        {personas.map((p) => (
          <li key={p.email} className="border border-rule p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-display text-2xl text-ivory">{p.displayName}</p>
              <span
                className={`border px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${
                  p.role === 'reader'
                    ? 'border-rule-strong text-grey-muted'
                    : 'border-gold/45 text-gold'
                }`}
              >
                {ROLE_LABEL[p.role]}
              </span>
            </div>

            <p className="mt-2.5 text-sm leading-normal text-grey-muted">
              {p.blurb}
            </p>

            <p className="mt-2 font-mono text-xs text-grey-faint">{p.email}</p>

            <form action={formAction}>
              <input type="hidden" name="email" value={p.email} />
              <input type="hidden" name="password" value="demo" />
              {next && <input type="hidden" name="next" value={next} />}
              <Enter name={p.displayName.split(' ')[0]} />
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}

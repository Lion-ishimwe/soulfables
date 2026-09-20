import type { Metadata } from 'next';
import { signIn } from '@/app/actions/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { DEMO_PERSONAS } from '@/lib/demo/session';
import {
  AuthShell,
  Field,
  SubmitButton,
  ActionForm,
  AuthLink,
} from '@/components/auth-shell';
import { PersonaPicker } from '@/components/persona-picker';

export const metadata: Metadata = { title: 'Sign In' };

const LINK_MESSAGES: Record<string, string> = {
  link_expired:
    'That emailed link has already been used, or it has expired. Links work once; ask for a new one and open it from the newest email.',
  missing_code: 'That link was incomplete. Open it from the email again, or ask for a new one.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const demo = isDemoMode();
  const linkMessage = error ? LINK_MESSAGES[error] : undefined;

  return (
    <AuthShell
      eyebrow="THE DOOR"
      title="Come in."
      intro={
        demo
          ? 'A demonstration, so there are no passwords. Choose who to come in as — the House looks different depending on which door you use.'
          : 'Your shelf, your progress and your reflections are where you left them.'
      }
      footer={
        demo ? null : (
          <>
            <p>
              No account yet? <AuthLink href="/signup">Join the House</AuthLink>
            </p>
            <p className="mt-2">
              <AuthLink href="/reset-password">Forgotten your password?</AuthLink>
            </p>
          </>
        )
      }
    >
      {linkMessage && (
        <p role="alert" className="mb-6 border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          {linkMessage}
        </p>
      )}
      {demo ? (
        <>
          <PersonaPicker personas={DEMO_PERSONAS} next={next} />

          <details className="mt-8 border-t border-rule pt-6">
            <summary className="cursor-pointer font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-colors hover:text-ivory">
              Or use your own address
            </summary>
            <div className="pt-5">
              <p className="mb-5 text-sm leading-normal text-grey-muted">
                Any address works and nothing is stored. An address that is
                not one of the three above comes in as a reader — the same as
                a real new account, which is never staff.
              </p>
              <ActionForm action={signIn} hiddenFields={next ? { next } : undefined}>
                <Field label="Email" name="email" type="email" autoComplete="email" />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required={false}
                  hint="Not checked."
                />
                <SubmitButton label="Enter the demo" pendingLabel="Opening…" />
              </ActionForm>
            </div>
          </details>
        </>
      ) : (
        <ActionForm action={signIn} hiddenFields={next ? { next } : undefined}>
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          <SubmitButton label="Sign in" pendingLabel="Opening…" />
        </ActionForm>
      )}
    </AuthShell>
  );
}

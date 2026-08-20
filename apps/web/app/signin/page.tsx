import type { Metadata } from 'next';
import { signIn } from '@/app/actions/auth';
import { AuthShell, Field, SubmitButton, ActionForm, AuthLink } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Sign In' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow="THE DOOR"
      title="Come in."
      intro="Your shelf, your progress and your reflections are where you left them."
      footer={
        <>
          <p>
            No account yet? <AuthLink href="/signup">Join the House</AuthLink>
          </p>
          <p className="mt-2">
            <AuthLink href="/reset-password">Forgotten your password?</AuthLink>
          </p>
        </>
      }
    >
      <ActionForm action={signIn} hiddenFields={next ? { next } : undefined}>
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" />
        <SubmitButton label="Sign in" pendingLabel="Opening…" />
      </ActionForm>
    </AuthShell>
  );
}

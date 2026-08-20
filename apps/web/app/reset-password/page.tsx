import type { Metadata } from 'next';
import { requestPasswordReset } from '@/app/actions/auth';
import { AuthShell, Field, SubmitButton, ActionForm, AuthLink } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="THE DOOR"
      title="Let's get you back in."
      intro="Tell us the address you joined with and we will send a link."
      footer={
        <p>
          Remembered it? <AuthLink href="/signin">Sign in</AuthLink>
        </p>
      }
    >
      <ActionForm action={requestPasswordReset}>
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <SubmitButton label="Send the link" pendingLabel="Sending…" />
      </ActionForm>
    </AuthShell>
  );
}

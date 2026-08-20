import type { Metadata } from 'next';
import { signUp } from '@/app/actions/auth';
import { AuthShell, Field, SubmitButton, ActionForm, AuthLink } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Join the House' };

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="THE DOOR"
      title="Join the House."
      intro="Keep the stories that stay with you, and a journal only you can read."
      footer={
        <p>
          Already have an account? <AuthLink href="/signin">Sign in</AuthLink>
        </p>
      }
    >
      <ActionForm action={signUp}>
        <Field label="Name" name="displayName" autoComplete="name" hint="What the House should call you." />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters. Length matters more than symbols."
        />
        <SubmitButton label="Join" pendingLabel="Preparing your shelf…" />
      </ActionForm>
    </AuthShell>
  );
}

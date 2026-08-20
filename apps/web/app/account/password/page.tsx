import type { Metadata } from 'next';
import { updatePassword } from '@/app/actions/auth';
import { AuthShell, Field, SubmitButton, ActionForm } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default function NewPasswordPage() {
  return (
    <AuthShell
      eyebrow="THE DOOR"
      title="Choose a new password."
      intro="This replaces the old one everywhere, on every device."
    >
      <ActionForm action={updatePassword}>
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters."
        />
        <SubmitButton label="Save it" pendingLabel="Saving…" />
      </ActionForm>
    </AuthShell>
  );
}

import type { Metadata } from 'next';
import { confirmEmailLink } from '@/app/actions/auth';
import { AuthShell, ActionForm, SubmitButton, AuthLink } from '@/components/auth-shell';

export const metadata: Metadata = { title: 'One more step', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const KINDS = new Set(['signup', 'recovery', 'magiclink', 'email_change', 'email', 'invite']);

const COPY: Record<string, { title: string; intro: string; button: string }> = {
  recovery: {
    title: 'Choose a new password.',
    intro: 'Press the button and the next page asks for it. The link works once.',
    button: 'Continue',
  },
  signup: {
    title: 'Welcome. One press and you are in.',
    intro: 'This confirms your address. The link works once.',
    button: 'Confirm and come in',
  },
  email_change: {
    title: 'Confirm your new address.',
    intro: 'One press and the House writes to the new address from now on.',
    button: 'Confirm',
  },
  default: {
    title: 'Come in.',
    intro: 'Press the button to open the link. It works once.',
    button: 'Continue',
  },
};

/**
 * Where an emailed link lands before it is used.
 *
 * Mail services open links to check them before the reader ever clicks,
 * and a link that signs you in on opening is spent by the time the
 * reader arrives: "invalid or expired", and a sign-in page. So the link
 * lands here, on a page that does nothing, and the reader's own press of
 * the button is what uses it. A scanner only ever sees this page.
 */
export default async function ConfirmLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash: tokenHash, type, next } = await searchParams;
  const kind = type && KINDS.has(type) ? type : '';
  const copy = COPY[kind] ?? COPY.default;

  if (!tokenHash || !kind) {
    return (
      <AuthShell
        eyebrow="THE DOOR"
        title="This link is incomplete."
        intro="Open it from the email again, or ask for a new one."
        footer={
          <p>
            <AuthLink href="/reset-password">Ask for a new link</AuthLink>
          </p>
        }
      >
        <></>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="THE DOOR"
      title={copy.title}
      intro={copy.intro}
      footer={
        <p>
          Link not working? <AuthLink href="/reset-password">Ask for a new one</AuthLink>
        </p>
      }
    >
      <ActionForm action={confirmEmailLink} hiddenFields={{ token_hash: tokenHash, type: kind, ...(next ? { next } : {}) }}>
        <SubmitButton label={copy.button} pendingLabel="Opening…" />
      </ActionForm>
    </AuthShell>
  );
}

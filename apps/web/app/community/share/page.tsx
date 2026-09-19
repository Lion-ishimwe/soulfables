import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { getActiveChallenge, listChallenges } from '@/lib/community';
import { ShareForm } from '@/components/community/share-form';

export const metadata: Metadata = { title: 'Share', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** The door to the wall. Signed-out readers see what it asks and where to sign in. */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string; prompt?: string }>;
}) {
  const [{ challenge: challengeSlug, prompt }, viewer] = await Promise.all([searchParams, getViewer()]);
  const active = await getActiveChallenge();
  const challenge =
    challengeSlug && active?.slug === challengeSlug
      ? active
      : challengeSlug
        ? ((await listChallenges()).find((c) => c.slug === challengeSlug && c.isActive) ?? null)
        : null;

  return (
    <div className="mx-auto max-w-content px-5 py-16 sm:px-8 sm:py-20">
      <Link href={'/community' as Route} className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory">
        ← The wall
      </Link>
      <header className="mb-10 mt-8">
        <p className="sf-eyebrow">Community</p>
        <h1 className="mt-3 font-display text-4xl font-light text-ivory">Share something.</h1>
        <p className="mt-4 max-w-measure text-base leading-normal text-grey-muted">
          A story of yours, or a reflection on one of the House’s. Under your name, a pen name, or no
          name at all. A person reads it before it appears.
        </p>
      </header>

      {viewer ? (
        <ShareForm
          displayName={viewer.displayName}
          challenge={challenge ? { id: challenge.id, title: challenge.title, prompt: challenge.prompt } : null}
          prefill={prompt}
        />
      ) : (
        <div className="rounded-xl border border-rule bg-ink-raised/60 p-8 text-center sm:p-10">
          <p className="font-display text-2xl text-ivory">Sharing needs a name the House knows.</p>
          <p className="mx-auto mt-3 max-w-measure text-sm leading-normal text-grey-muted">
            Sign in to write to the wall. You can still share under a pen name, or none.
          </p>
          <Link
            href={'/signin?next=/community/share' as Route}
            className="mt-7 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      )}

      <section className="mt-12 border-l-2 border-rule-strong pl-6">
        <h2 className="sf-eyebrow mb-3">The wall’s few rules</h2>
        <ul className="max-w-measure space-y-2 font-ui text-sm leading-relaxed text-grey-muted">
          <li>Write about your own life, or about a story. Not about another reader.</li>
          <li>No names of people who did not agree to be here. No addresses, no phone numbers.</li>
          <li>Company, not advice. Nobody here is anyone’s doctor.</li>
          <li>Nothing for sale, nothing to sign up for.</li>
          <li>If you are in danger, please reach a person who can help; the wall cannot.</li>
        </ul>
      </section>
    </div>
  );
}

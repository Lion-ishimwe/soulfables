import type { Metadata } from 'next';
import { getViewer } from '@/lib/auth';
import { CompanionChat } from '@/components/companion-chat';

export const metadata: Metadata = {
  title: 'The Librarian',
  description:
    'A companion for reflection — talk about a story, or find the one that meets you where you are.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function CompanionPage() {
  const viewer = await getViewer();

  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="mb-10 text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The House</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          The Librarian
        </h1>
        <p className="mx-auto mt-4 max-w-measure font-display text-xl italic text-grey-muted">
          Chooses what you read before you know you need it.
        </p>
      </header>

      <CompanionChat signedIn={Boolean(viewer)} />
    </div>
  );
}

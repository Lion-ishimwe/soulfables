import type { Metadata } from 'next';
import { getViewer, isStaff } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/membership';
import { claudeConfigured } from '@/lib/ai/claude';
import { isDemoMode } from '@/lib/demo/mode';
import { CompanionChat } from '@/components/companion-chat';
import { SoulStory } from '@/components/soul-story';

export const metadata: Metadata = {
  title: 'The Librarian',
  description:
    'A companion for reflection — talk about a story, find the one that meets you where you are, or ask for a story written for how you feel.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The Librarian's room.
 *
 * Two things happen here. The conversation, which every signed-in
 * reader may have: free readers talk with the House's rule-based
 * Librarian, who listens for a shelf and points at real stories; Premium
 * readers talk with a generated companion that can also offer a
 * question, a prompt or an affirmation, under the same safety screen.
 * And, for Premium, a story written for how they feel tonight.
 *
 * Nothing here is a therapist. The page says so where it matters, the
 * safety screen runs before any reply, and every generated word is
 * labelled as one.
 */
export default async function CompanionPage() {
  const viewer = await getViewer();
  const premium = viewer ? isStaff(viewer.role) || (await hasPremiumAccess()) : false;
  // The note above the chat must describe who actually answers: the
  // demo has no model, so it never claims one.
  const model = premium && !isDemoMode() && claudeConfigured();

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
        <p className="mx-auto mt-4 max-w-measure font-ui text-xs leading-relaxed text-grey-faint">
          A companion for reflection, not a therapist. It asks, it notices, and it points at
          stories. If an evening is heavier than a story can hold, it will say so and point you to
          a person.
        </p>
      </header>

      <CompanionChat signedIn={Boolean(viewer)} model={model} />

      <section className="mt-16 border-t border-rule pt-10">
        <p className="sf-eyebrow">Ask for a story</p>
        <h2 className="mt-2 font-display text-3xl font-light text-ivory">
          A story written for how you feel.
        </h2>
        <p className="mt-3 max-w-measure font-ui text-sm leading-relaxed text-grey-muted">
          Say a feeling, in a word or a sentence. The Librarian writes you a short folktale for it,
          a lesson drawn gently from it, and one question to write to. Every story is labelled as
          generated, and none is placed in the library.
        </p>
        <div className="mt-7">
          <SoulStory allowed={premium} signedIn={Boolean(viewer)} />
        </div>
      </section>
    </div>
  );
}

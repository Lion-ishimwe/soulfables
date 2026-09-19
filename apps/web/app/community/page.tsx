import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { getActiveChallenge, listMyPosts, listPublishedPosts, REACTIONS } from '@/lib/community';
import { getTodaysPrompt } from '@/lib/journal';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Community',
  description: 'People connect through stories. Share one, or a reflection, and find company in what others have shared.',
};

export const dynamic = 'force-dynamic';

/**
 * The wall.
 *
 * Published posts, newest first, under the running challenge and
 * today's prompt. Everything on it has been read by a person at the
 * House first, and it says so. A reader's own pending posts appear to
 * them alone, so they can see where each one is.
 */
export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const [{ sent }, viewer, posts, challenge, prompt, mine] = await Promise.all([
    searchParams,
    getViewer(),
    listPublishedPosts(),
    getActiveChallenge(),
    getTodaysPrompt(),
    listMyPosts(),
  ]);
  const waiting = mine.filter((p) => p.status === 'pending');

  return (
    <div className="mx-auto max-w-page px-5 py-16 sm:px-8 sm:py-20">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The House</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">Community</h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          People connect through stories. Share one of yours, or a reflection, and find company in
          what others have shared. A person at the House reads everything before it appears.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={'/community/share' as Route}
            className="bg-gold px-7 py-3 font-ui text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:bg-gold-soft"
          >
            Share something
          </Link>
        </div>
      </header>

      {sent && (
        <p aria-live="polite" className="mx-auto mt-8 max-w-content border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          Sent to the House. Someone will read it, usually within a day, and it will appear here after.
        </p>
      )}

      {waiting.length > 0 && (
        <p className="mx-auto mt-6 max-w-content font-ui text-xs text-grey-muted">
          {waiting.length === 1 ? 'One of yours is' : `${waiting.length} of yours are`} waiting to be read.
        </p>
      )}

      {/* ---- The doors: challenge and prompt ---------------------------- */}
      <div className="mx-auto mt-12 grid max-w-content gap-px bg-rule sm:grid-cols-2">
        {challenge ? (
          <div className="bg-ink p-7">
            <p className="sf-eyebrow">This month’s challenge</p>
            <h2 className="mt-2 font-display text-2xl font-light text-ivory">{challenge.title}</h2>
            <p className="mt-2 font-display text-base italic leading-snug text-grey-muted">{challenge.prompt}</p>
            <p className="mt-3 font-ui text-xs text-grey-faint">Until {formatDate(challenge.endsOn)}</p>
            <Link href={`/community/share?challenge=${challenge.slug}` as Route} className="mt-4 inline-block font-ui text-sm text-gold transition-colors hover:text-gold-soft">
              Respond →
            </Link>
          </div>
        ) : (
          <div className="bg-ink p-7">
            <p className="sf-eyebrow">Challenges</p>
            <p className="mt-2 font-display text-base italic text-grey-muted">The next challenge is being written.</p>
          </div>
        )}
        <div className="bg-ink p-7">
          <p className="sf-eyebrow">Today’s prompt</p>
          {prompt ? (
            <>
              <p className="mt-2 font-display text-xl italic leading-snug text-ivory">{prompt.body}</p>
              <p className="mt-3 font-ui text-xs text-grey-faint">Write to it privately in your journal, or share what comes.</p>
              <div className="mt-4 flex flex-wrap gap-x-5">
                <Link href={'/journal' as Route} className="font-ui text-sm text-gold transition-colors hover:text-gold-soft">In the journal →</Link>
                <Link href={`/community/share?prompt=${encodeURIComponent(prompt.body)}` as Route} className="font-ui text-sm text-gold transition-colors hover:text-gold-soft">Share it →</Link>
              </div>
            </>
          ) : (
            <p className="mt-2 font-display text-base italic text-grey-muted">No prompt today.</p>
          )}
        </div>
      </div>

      {/* ---- The wall ------------------------------------------------- */}
      <section className="mx-auto mt-14 max-w-content">
        <p className="sf-eyebrow">What people have shared</p>
        {posts.length === 0 ? (
          <p className="mt-6 font-display text-xl italic text-grey-muted">The wall is bare. Be the first, and gently.</p>
        ) : (
          <ul className="mt-6 divide-y divide-rule border-y border-rule">
            {posts.map((p) => (
              <li key={p.id} className="py-7">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-xs text-grey-muted">
                  <span className="text-ivory">{p.authorName}</span>
                  <span>·</span>
                  <span>{p.kind === 'story' ? 'a story' : p.kind === 'response' ? `for “${p.challengeTitle ?? 'the challenge'}”` : 'a reflection'}</span>
                  <span>·</span>
                  <span>{formatDate(p.publishedAt ?? p.createdAt)}</span>
                </p>
                <Link href={`/community/${p.id}` as Route} className="group mt-3 block">
                  {p.title && <h2 className="font-display text-2xl font-light text-ivory transition-colors group-hover:text-gold">{p.title}</h2>}
                  <p className={`font-reading text-base leading-relaxed text-grey ${p.title ? 'mt-2' : ''}`}>
                    {p.body.length > 320 ? `${p.body.slice(0, 317).trimEnd()}…` : p.body}
                  </p>
                </Link>
                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-ui text-xs text-grey-muted">
                  {REACTIONS.map((r) => (
                    <span key={r.kind}>
                      <span className="text-gold">✦</span> {r.label} {p.reactions[r.kind]}
                    </span>
                  ))}
                  <span>{p.replies} {p.replies === 1 ? 'reply' : 'replies'}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mx-auto mt-12 max-w-measure text-center font-ui text-xs leading-relaxed text-grey-faint">
        The wall is a quiet room. Everything on it was read by a person at the House first; anything
        unkind is taken down, and anything that sounds like danger is met with help, not applause.
        {!viewer && (
          <>
            {' '}
            <Link href={'/signin?next=/community' as Route} className="text-gold hover:text-gold-soft">Sign in</Link> to share or respond.
          </>
        )}
      </p>
    </div>
  );
}

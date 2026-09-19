import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { getPost, REACTIONS } from '@/lib/community';
import { formatDate } from '@/lib/format';
import { toggleReaction } from '@/app/actions/community';
import { ReplyForm } from '@/components/community/reply-form';
import { ReportButton } from '@/components/community/report-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const found = await getPost(id);
  return found ? { title: found.post.title ?? `${found.post.authorName} on the wall` } : { title: 'Community' };
}

/**
 * One post: the words, the three reactions, the replies, and the way to
 * report it. The writer sees their own pending post here with a note
 * that it is waiting; everyone else sees only what has been published.
 */
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reported?: string }>;
}) {
  const [{ id }, { reported }, viewer] = await Promise.all([params, searchParams, getViewer()]);
  const found = await getPost(id);
  if (!found) notFound();
  const { post, mine, replies } = found;
  const shown = replies.filter((r) => r.status === 'published' || (viewer && r.userId === viewer.id));

  return (
    <div className="mx-auto max-w-content px-5 py-16 sm:px-8 sm:py-20">
      <Link href={'/community' as Route} className="font-ui text-sm text-grey-muted transition-colors hover:text-ivory">
        ← The wall
      </Link>

      {post.status !== 'published' && (
        <p className="mt-6 border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          {post.status === 'pending'
            ? 'Waiting to be read. Only you can see it until then.'
            : post.status === 'rejected'
              ? `The House did not put this on the wall.${post.reviewNote ? ` ${post.reviewNote}` : ''}`
              : 'This was taken down.'}
        </p>
      )}
      {reported && (
        <p aria-live="polite" className="mt-6 border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          Thank you. Someone at the House will look.
        </p>
      )}

      <article className="mt-8">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-xs text-grey-muted">
          <span className="text-ivory">{post.authorName}</span>
          <span>·</span>
          <span>{post.kind === 'story' ? 'a story' : post.kind === 'response' ? `for “${post.challengeTitle ?? 'the challenge'}”` : 'a reflection'}</span>
          <span>·</span>
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </p>
        {post.title && <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory">{post.title}</h1>}
        <div className={`space-y-4 ${post.title ? 'mt-6' : 'mt-4'}`}>
          {post.body.split(/\n\s*\n/).map((para, i) => (
            <p key={i} className="font-reading text-lg leading-relaxed text-grey">
              {para}
            </p>
          ))}
        </div>

        {/* ---- Three words ---------------------------------------------- */}
        <div className="mt-8 flex flex-wrap items-center gap-2.5 border-t border-rule pt-6">
          {REACTIONS.map((r) => {
            const on = mine.includes(r.kind);
            return (
              <form key={r.kind} action={toggleReaction}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="kind" value={r.kind} />
                <button
                  type="submit"
                  aria-pressed={on}
                  disabled={post.status !== 'published'}
                  className={`border px-4 py-2 font-ui text-xs uppercase tracking-[0.14em] transition-colors disabled:opacity-40 ${
                    on ? 'border-gold bg-gold text-ink' : 'border-rule text-grey-muted hover:border-gold/50 hover:text-gold'
                  }`}
                >
                  {r.label} · {post.reactions[r.kind]}
                </button>
              </form>
            );
          })}
          <span className="ml-auto">
            {viewer && post.status === 'published' && <ReportButton targetType="post" targetId={post.id} postId={post.id} />}
          </span>
        </div>
      </article>

      {/* ---- Replies ----------------------------------------------------- */}
      <section className="mt-12">
        <p className="sf-eyebrow">Replies</p>
        {shown.length === 0 ? (
          <p className="mt-4 font-display text-base italic text-grey-muted">Nobody has replied yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {shown.map((r) => (
              <li key={r.id} className={`border-l-2 pl-5 ${r.status === 'pending' ? 'border-rule' : 'border-gold/40'}`}>
                <p className="font-ui text-xs text-grey-muted">
                  <span className="text-ivory">{r.authorName}</span> · {formatDate(r.createdAt)}
                  {r.status === 'pending' && <span className="ml-2 text-grey-faint">waiting to be read</span>}
                </p>
                <p className="mt-1.5 font-reading text-base leading-relaxed text-grey">{r.body}</p>
                {viewer && r.status === 'published' && r.userId !== viewer.id && (
                  <div className="mt-1.5">
                    <ReportButton targetType="reply" targetId={r.id} postId={post.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {viewer ? (
          post.status === 'published' && <ReplyForm postId={post.id} />
        ) : (
          <p className="mt-6 font-ui text-sm text-grey-muted">
            <Link href={`/signin?next=/community/${post.id}` as Route} className="text-gold hover:text-gold-soft">Sign in</Link> to reply or to say you were here.
          </p>
        )}
      </section>
    </div>
  );
}

import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { listChallenges, listOpenReports, listPendingPosts, listPendingReplies } from '@/lib/community';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/admin/ui';
import { ChallengeForm } from '@/components/admin/challenge-form';
import { removeContent, reviewPost, reviewReply, setTrusted } from '@/app/actions/community';

export const metadata: Metadata = { title: 'Community' };
export const dynamic = 'force-dynamic';

const btn = 'whitespace-nowrap border px-3 py-1.5 font-ui text-[0.65rem] uppercase tracking-[0.14em] transition-all disabled:opacity-50';
const gold = `${btn} border-gold/50 text-gold hover:bg-gold hover:text-ink`;
const grey = `${btn} border-rule text-grey-muted hover:border-state-danger/60 hover:text-ivory`;
const soft = `${btn} border-rule text-grey-muted hover:border-gold/50 hover:text-ivory`;

/**
 * The community's back room.
 *
 * Four queues, in the order they need attention: reports, posts waiting
 * to be read, replies waiting, and the challenges. Every decision is a
 * plain form and lands in the audit log.
 */
export default async function CommunityAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; saved?: string; edit?: string }>;
}) {
  await requireStaff();
  const [{ done, saved, edit }, posts, replies, reports, challenges] = await Promise.all([
    searchParams,
    listPendingPosts(),
    listPendingReplies(),
    listOpenReports(),
    listChallenges(),
  ]);
  const editing = edit ? (challenges.find((c) => c.slug === edit) ?? null) : null;
  const demo = isDemoMode();

  return (
    <>
      <PageHeader title="Community" subtitle="What readers have shared, waiting for a person to read it." />

      {(done || saved) && (
        <p aria-live="polite" className="mb-6 rounded border-l-2 border-state-success bg-state-success/10 px-4 py-3 font-ui text-sm text-ivory">
          {saved ? `“${saved}” is set.` : 'Done.'}
        </p>
      )}
      {demo && (
        <p className="mb-6 rounded border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          The demo has no queue: nothing readers write is kept.
        </p>
      )}

      {/* ---- Reports ----------------------------------------------------- */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-ivory">Reports {reports.length > 0 && <span className="text-gold">· {reports.length}</span>}</h2>
        {reports.length === 0 ? (
          <p className="mt-2 font-ui text-sm text-grey-muted">Nothing reported.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-ink-raised">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-ui text-xs text-grey-muted">
                    A {r.targetType} · {r.reason}{r.note ? ` · “${r.note}”` : ''} · {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-1 font-reading text-sm text-grey">{r.snippet ?? 'Already gone.'}</p>
                </div>
                <div className="flex gap-2">
                  <form action={removeContent}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="targetType" value={r.targetType} />
                    <input type="hidden" name="targetId" value={r.targetId} />
                    <button type="submit" disabled={demo} className={grey}>Take it down</button>
                  </form>
                  <form action={removeContent}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="targetType" value={r.targetType} />
                    <input type="hidden" name="targetId" value={r.targetId} />
                    <input type="hidden" name="keep" value="1" />
                    <button type="submit" disabled={demo} className={soft}>Keep it</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Posts waiting -------------------------------------------- */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-ivory">Waiting to be read {posts.length > 0 && <span className="text-gold">· {posts.length}</span>}</h2>
        {posts.length === 0 ? (
          <p className="mt-2 font-ui text-sm text-grey-muted">The queue is empty.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {posts.map((p) => (
              <li key={p.id} className="rounded-lg border border-rule bg-ink-raised px-6 py-5">
                <p className="font-ui text-xs text-grey-muted">
                  <span className="text-ivory">{p.authorName}</span>{p.anonymous ? ' (anonymous)' : ''} · {p.kind}
                  {p.challengeTitle ? ` · for “${p.challengeTitle}”` : ''} · {formatDate(p.createdAt)}
                  {p.trusted && <span className="ml-2 text-gold">trusted</span>}
                </p>
                {p.title && <p className="mt-2 font-display text-xl text-ivory">{p.title}</p>}
                <p className="mt-2 whitespace-pre-line font-reading text-base leading-relaxed text-grey">{p.body}</p>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={reviewPost} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button type="submit" disabled={demo} className={gold}>Put it on the wall</button>
                  </form>
                  <form action={reviewPost} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <input name="note" maxLength={500} placeholder="A word to the writer, optional" className="border border-rule bg-ink px-2.5 py-1.5 font-ui text-xs text-ivory" />
                    <button type="submit" disabled={demo} className={grey}>Not this one</button>
                  </form>
                  {!p.trusted && (
                    <form action={setTrusted}>
                      <input type="hidden" name="userId" value={p.userId} />
                      <input type="hidden" name="trusted" value="1" />
                      <button type="submit" disabled={demo} className={soft}>Trust this reader</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Replies waiting ------------------------------------------ */}
      <section className="mb-12">
        <h2 className="font-display text-2xl text-ivory">Replies waiting {replies.length > 0 && <span className="text-gold">· {replies.length}</span>}</h2>
        {replies.length === 0 ? (
          <p className="mt-2 font-ui text-sm text-grey-muted">None.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule rounded-lg border border-rule bg-ink-raised">
            {replies.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-ui text-xs text-grey-muted">
                    <span className="text-ivory">{r.authorName}</span> under{' '}
                    <Link href={`/community/${r.postId}` as Route} className="text-gold hover:text-gold-soft">{r.postTitle ?? 'a post'}</Link> · {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-1 font-reading text-sm text-grey">{r.body}</p>
                </div>
                <div className="flex gap-2">
                  <form action={reviewReply}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="postId" value={r.postId} />
                    <input type="hidden" name="decision" value="approve" />
                    <button type="submit" disabled={demo} className={gold}>Show it</button>
                  </form>
                  <form action={reviewReply}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="postId" value={r.postId} />
                    <input type="hidden" name="decision" value="remove" />
                    <button type="submit" disabled={demo} className={grey}>Not this</button>
                  </form>
                  {!r.trusted && (
                    <form action={setTrusted}>
                      <input type="hidden" name="userId" value={r.userId} />
                      <input type="hidden" name="trusted" value="1" />
                      <button type="submit" disabled={demo} className={soft}>Trust</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Challenges ------------------------------------------------- */}
      <section>
        <h2 className="font-display text-2xl text-ivory">Challenges</h2>
        <div className="mt-4 space-y-6">
          <ChallengeForm key={editing?.slug ?? 'new'} challenge={editing} readOnly={demo} />
          {challenges.length > 0 && (
            <ul className="divide-y divide-rule rounded-lg border border-rule bg-ink-raised">
              {challenges.map((c) => (
                <li key={c.slug} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-display text-base text-ivory">{c.title}</p>
                    <p className="font-ui text-xs text-grey-muted">
                      {formatDate(c.startsOn)} – {formatDate(c.endsOn)}{c.isActive ? '' : ' · off'}
                    </p>
                  </div>
                  <Link href={`/admin/community?edit=${c.slug}` as Route} className={gold}>Edit</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

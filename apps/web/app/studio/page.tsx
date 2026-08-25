import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer, isStaff } from '@/lib/auth';
import {
  accountForEmail,
  listStoriesForAuthor,
  listWorkStories,
  notificationsFor,
} from '@/lib/admin-data';
import { StatusPill } from '@/components/admin/ui';
import { TemplatePanel } from '@/components/studio/template-panel';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'The Writing Room',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/*
 * Where an author works.
 *
 * Separate from /admin because the jobs are different: an author writes
 * and submits, staff review and publish. Someone who only writes should
 * not have to walk past orders and analytics to reach their own drafts.
 *
 * Staff see this too — they write as well — but they also have the admin,
 * and the link across is right at the top.
 */
export default async function StudioPage() {
  const viewer = await requireViewer('/studio');
  const account = await accountForEmail(viewer.email);
  const staff = isStaff(viewer.role);

  // Staff without an author account still get a workspace; they simply
  // see everything rather than one byline's worth.
  const mine = account
    ? await listStoriesForAuthor(account.authorSlug)
    : staff
      ? (await listWorkStories()).filter((s) => s.status !== 'published')
      : [];

  const notes = account ? await notificationsFor(account.authorSlug) : [];
  const unread = notes.filter((n) => !n.readAt);

  const drafts = mine.filter((s) => s.status === 'draft');
  const waiting = mine.filter((s) => s.status === 'in_review');
  const out = mine.filter((s) => s.status === 'published');

  if (!account && !staff) {
    return (
      <div className="mx-auto max-w-content px-5 py-24 text-center sm:px-8">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The Writing Room</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory">
          This room is for the House&rsquo;s writers.
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-sm leading-normal text-grey-muted">
          Soulfables gives writers an account when it invites them. If you
          have been writing for us and cannot get in, write to{' '}
          <a
            href="mailto:hello@soulfables.com"
            className="text-gold transition-colors hover:text-gold-soft"
          >
            hello@soulfables.com
          </a>
          .
        </p>
        <Link
          href="/library"
          className="mt-8 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          Back to the library
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-page px-5 py-16 sm:px-8">
      <header className="mb-12 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-gold" aria-hidden="true">✦</p>
          <p className="sf-eyebrow mt-5">The Writing Room</p>
          <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
            {account ? `${viewer.displayName ?? 'Your'} desk` : 'The desk'}
          </h1>
        </div>

        {staff && (
          <Link
            href="/admin/submissions"
            className="font-ui text-sm text-gold transition-colors hover:text-gold-soft"
          >
            Review submissions →
          </Link>
        )}
      </header>

      {/* What the House has said. */}
      {unread.length > 0 && (
        <section className="mb-12">
          <h2 className="sf-eyebrow mb-4">News</h2>
          <ul className="space-y-px bg-rule">
            {unread.map((n) => (
              <li key={n.id} className="bg-gold-dim px-6 py-4">
                <p className="font-display text-xl text-ivory">{n.title}</p>
                {n.body && (
                  <p className="mt-1.5 text-sm leading-normal text-grey">{n.body}</p>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-4 text-xs text-grey-muted">
                  <span>{formatDate(n.createdAt)}</span>
                  {n.href && (
                    <Link
                      href={n.href as '/studio'}
                      className="text-gold transition-colors hover:text-gold-soft"
                    >
                      Open
                    </Link>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Start something. */}
      <section className="mb-12">
        <h2 className="sf-eyebrow mb-4">Begin</h2>
        <TemplatePanel />
      </section>

      {/* In progress. */}
      {[
        { title: 'Drafts', rows: drafts, note: 'Yours until you send them in.' },
        { title: 'With the House', rows: waiting, note: 'Being read. Nothing more is needed from you.' },
        { title: 'Published', rows: out, note: null },
      ].map((group) =>
        group.rows.length > 0 ? (
          <section key={group.title} className="mb-12">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="sf-eyebrow">{group.title}</h2>
              {group.note && (
                <span className="font-ui text-xs text-grey-muted">{group.note}</span>
              )}
            </div>

            <ul className="divide-y divide-rule border border-rule">
              {group.rows.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/studio/${s.slug}`}
                    className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-ink-raised"
                  >
                    <span className="min-w-0">
                      <span className="block font-display text-xl text-ivory">
                        {s.title}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-3 text-xs text-grey-muted">
                        <span>{s.shelfLabel ?? 'No shelf'}</span>
                        {s.releaseMode === 'serial' && (
                          <span>
                            {s.chapters.filter((c) => c.status === 'published').length}
                            /{s.chapters.length} chapters out
                          </span>
                        )}
                        {s.revisionNote && (
                          <span className="text-gold">Came back with a note</span>
                        )}
                        {s.assignedAuthorSlug &&
                          s.authorSlug &&
                          s.assignedAuthorSlug !== s.authorSlug && (
                            <span>Begun by {s.authorName}</span>
                          )}
                      </span>
                    </span>

                    <StatusPill status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {mine.length === 0 && (
        <div className="border border-rule px-8 py-14 text-center">
          <p className="font-display text-2xl text-ivory">Nothing on the desk.</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-normal text-grey-muted">
            Download the template, write somewhere comfortable, and bring it
            back when it is ready.
          </p>
        </div>
      )}
    </div>
  );
}

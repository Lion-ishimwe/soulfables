import type { Metadata } from 'next';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import {
  getOwnedProducts,
  getReading,
  getSavedStories,
  getBookmarks,
  getPassages,
  formatBytes,
} from '@/lib/library';
import { removeBookmark, removePassage } from '@/app/actions/reading';

export const metadata: Metadata = {
  title: 'My Library',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The reader's own shelf: what they own, what they are part-way through,
 * what they kept, and what they finished.
 *
 * Downloads are links to /api/download/[fileId], which re-checks the
 * entitlement and mints a two-minute signed URL. No storage path or
 * public file URL ever reaches this page.
 */
export default async function MyLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ already?: string }>;
}) {
  const [{ already }, viewer] = await Promise.all([
    searchParams,
    requireViewer('/account/library'),
  ]);

  const [owned, reading, saved, bookmarks, passages] = await Promise.all([
    getOwnedProducts(),
    getReading(),
    getSavedStories(),
    getBookmarks(),
    getPassages(),
  ]);

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mb-14">
        <p className="text-gold" aria-hidden="true">
          ✦
        </p>
        <p className="sf-eyebrow mt-5">Your shelf</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          {viewer.displayName ? `${viewer.displayName}'s library` : 'My Library'}
        </h1>
      </header>

      {already && (
        <p className="mb-10 border-l-2 border-gold bg-gold-dim px-4 py-3 text-sm text-ivory">
          You already own that one — it is below.
        </p>
      )}

      {/* Purchased */}
      <section className="mb-16">
        <h2 className="sf-eyebrow mb-6">Purchased</h2>

        {owned.length === 0 ? (
          <div className="border border-rule px-8 py-14 text-center">
            <p className="font-display text-2xl text-ivory">
              Nothing on this shelf yet.
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-normal text-grey-muted">
              Books you buy appear here the moment payment clears, in every
              format they ship in. They stay yours.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
            >
              Visit the bookshop
            </Link>
          </div>
        ) : (
          <ul className="grid gap-px bg-rule sm:grid-cols-2">
            {owned.map((p) => (
              <li key={p.productId} className="bg-ink p-7">
                <h3 className="font-display text-2xl font-light text-ivory">
                  {p.title}
                </h3>
                {p.subtitle && (
                  <p className="mt-1.5 text-sm text-grey-muted">{p.subtitle}</p>
                )}

                {p.files.length === 0 ? (
                  <p className="mt-5 text-xs text-grey-muted">
                    The files for this one are being prepared. It will appear
                    here without you having to do anything.
                  </p>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {p.files.map((f) => (
                      <a
                        key={f.id}
                        href={`/api/download/${f.id}`}
                        className="border border-rule px-4 py-2 font-ui text-xs uppercase tracking-[0.14em] text-grey transition-all duration-base ease-house hover:border-gold/50 hover:text-gold"
                      >
                        {f.format}
                        {f.sizeBytes && (
                          <span className="ml-2 normal-case tracking-normal text-grey-muted">
                            {formatBytes(f.sizeBytes)}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}

                {p.source === 'manual' && (
                  <p className="mt-4 text-xs text-grey-muted">
                    Added to your library by Soulfables.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Reading */}
      {reading.inProgress.length > 0 && (
        <section className="mb-16">
          <h2 className="sf-eyebrow mb-6">Still reading</h2>
          <ul className="divide-y divide-rule border border-rule">
            {reading.inProgress.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/story/${r.slug}`}
                  className="flex items-center justify-between gap-5 px-6 py-4 transition-colors hover:bg-ink-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-xl text-ivory">
                      {r.title}
                    </span>
                    <span className="mt-1 block text-xs text-grey-muted">
                      {Math.round(r.percent * 100)}% through
                      {r.readingMinutes ? ` · ${r.readingMinutes} min` : ''}
                    </span>
                  </span>
                  {/* Progress as form, not just a number. */}
                  <span
                    className="h-px w-24 flex-none bg-rule-strong"
                    role="img"
                    aria-label={`${Math.round(r.percent * 100)} percent read`}
                  >
                    <span
                      className="block h-px bg-gold"
                      style={{ width: `${Math.max(4, r.percent * 100)}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Saved */}
      {saved.length > 0 && (
        <section className="mb-16">
          <h2 className="sf-eyebrow mb-6">Kept</h2>
          <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((s) => (
              <li key={s!.slug}>
                <Link
                  href={`/story/${s!.slug}`}
                  className="block h-full bg-ink p-6 transition-colors hover:bg-ink-raised"
                >
                  <p className="font-display text-xl text-ivory">{s!.title}</p>
                  <p className="mt-2 text-sm text-grey-muted">{s!.subtitle}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Bookmarks */}
      {bookmarks.length > 0 && (
        <section className="mb-16">
          <h2 className="sf-eyebrow mb-6">Bookmarks</h2>
          <ul className="divide-y divide-rule border border-rule">
            {bookmarks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/story/${b.storySlug}`}
                    className="font-display text-xl text-ivory transition-colors hover:text-gold"
                  >
                    {b.storyTitle ?? b.storySlug}
                  </Link>
                  <p className="mt-1 text-xs text-grey-muted">
                    {b.sectionTitle ?? 'The story as a whole'}
                    {b.note && <span className="text-grey"> &mdash; {b.note}</span>}
                  </p>
                </div>
                <form action={removeBookmark}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Kept passages */}
      {passages.length > 0 && (
        <section className="mb-16">
          <h2 className="sf-eyebrow mb-2">Saved passages</h2>
          <p className="mb-6 text-sm text-grey-muted">
            Some sentences ask to be remembered.
          </p>
          <ul className="space-y-px bg-rule">
            {passages.map((p) => (
              <li key={p.id} className="bg-ink px-7 py-6">
                <blockquote className="border-l border-gold pl-5 font-display text-xl font-light italic leading-snug text-ivory">
                  {p.quote}
                </blockquote>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={`/story/${p.storySlug}`}
                    className="font-ui text-xs text-gold transition-colors hover:text-gold-soft"
                  >
                    {p.storyTitle ?? p.storySlug} &rarr;
                  </Link>
                  <form action={removePassage}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger"
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Finished */}
      {reading.finished.length > 0 && (
        <section>
          <h2 className="sf-eyebrow mb-6">Finished</h2>
          <ul className="flex flex-wrap gap-2.5">
            {reading.finished.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/story/${r.slug}`}
                  className="inline-block border border-rule px-4 py-2 font-ui text-sm text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { chooseWander } from '@/lib/wander';
import { track } from '@/lib/analytics';
import { QuietPage } from '@/components/quiet-page';
import { StoryHero } from '@/components/story-hero';
import { ShelfGlyph } from '@/components/shelf-glyph';

export const metadata: Metadata = {
  title: 'Wander',
  description: 'Let the Librarian choose. One story, picked for you and the hour you are in.',
  alternates: { canonical: '/wander' },
};

// Chosen for whoever is here, so it cannot be prerendered.
export const dynamic = 'force-dynamic';

/*
 * Wander.
 *
 * You arrive without a destination and are handed a story, with the
 * reason it was chosen. Say how the hour feels and the choice narrows to
 * that shelf; ask for another and you get another, never the same one
 * twice in a visit. Everything is a link: the page works before any
 * script has loaded, can be bookmarked mid-wander, and survives a
 * refresh.
 *
 * The story is shown the way its own page shows it — the art as the
 * room — because being handed a book should feel like being handed the
 * book, not a card about it.
 */
export default async function WanderPage({
  searchParams,
}: {
  searchParams: Promise<{ mood?: string; seen?: string }>;
}) {
  const params = await searchParams;
  const seen = (params.seen ?? '').split(',').filter(Boolean).slice(-20);

  const { pick, moods } = await chooseWander({ mood: params.mood, seen });

  if (!pick) {
    return (
      <QuietPage
        eyebrow="NO DESTINATION"
        title="The shelves are still being filled."
        body="The Librarian has nothing to hand you yet. Come back when there are stories to wander into."
      />
    );
  }

  const { story, shelf, reason, mood } = pick;

  // Counted, so whether anybody wanders can be answered later.
  void track('wander_chosen', {
    entityType: 'story',
    entityId: story.id,
    properties: { slug: story.slug, mood: mood?.slug ?? null, seen: seen.length },
  });

  const wanderHref = (opts: { mood?: string | null; seen?: string[] }) => {
    const q = new URLSearchParams();
    if (opts.mood) q.set('mood', opts.mood);
    if (opts.seen && opts.seen.length) q.set('seen', opts.seen.join(','));
    const qs = q.toString();
    return (qs ? `/wander?${qs}` : '/wander') as Route;
  };

  const anotherHref = wanderHref({ mood: mood?.slug, seen: [...seen, story.slug] });

  return (
    <>
      <StoryHero
        story={story}
        shelf={shelf}
        href={`/story/${story.slug}`}
        intro={
          <p className="mb-6 flex items-center justify-center gap-2 font-ui text-micro uppercase tracking-[0.24em] text-gold">
            <span aria-hidden="true">✦</span> The Librarian chose this for you
          </p>
        }
        after={
          <>
            <p className="mx-auto mt-6 max-w-measure font-reading text-base italic leading-relaxed text-grey">
              {reason}
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-6">
              <Link
                href={`/story/${story.slug}` as Route}
                className="rounded bg-gold px-8 py-3 font-ui text-sm text-ink transition-opacity hover:opacity-90"
              >
                Begin reading
              </Link>
              <Link
                href={anotherHref}
                className="font-ui text-sm text-grey transition-colors hover:text-ivory"
              >
                Hand me another →
              </Link>
            </div>
          </>
        }
      />

      {/*
        The one question, asked after the offer rather than before it: a
        reader who does not want to answer already has a story. A chip
        narrows the next choice to that feeling's shelf; the lit chip is
        the one in force, and choosing it again lets go of it.
      */}
      {moods.length > 0 && (
        <section className="mx-auto max-w-content px-5 pb-24 pt-4 text-center sm:px-8">
          <p className="sf-eyebrow">Or tell me the hour you are in</p>
          <ul className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-3">
            {moods.map((m) => {
              const on = mood?.slug === m.slug;
              return (
                <li key={m.slug}>
                  <Link
                    href={wanderHref({ mood: on ? null : m.slug, seen })}
                    aria-pressed={on}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 font-ui text-sm transition-colors duration-base ease-house ${
                      on
                        ? 'border-gold/60 bg-gold-dim text-gold'
                        : 'border-rule text-grey hover:border-gold/40 hover:text-ivory'
                    }`}
                  >
                    {m.shelfSlug && <ShelfGlyph slug={m.shelfSlug} className="h-3.5 w-3.5 text-gold" />}
                    {m.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-8 font-ui text-xs text-grey-muted">
            {seen.length > 0
              ? `${seen.length} ${seen.length === 1 ? 'story' : 'stories'} passed over this visit.`
              : 'Nothing is remembered about the wander once you leave.'}
          </p>
        </section>
      )}
    </>
  );
}

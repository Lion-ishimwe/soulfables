import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStories, getStory, getShelf, getResidents } from '@/lib/content';
import { StoryBody } from '@/lib/story-body';
import { ReaderControls } from '@/components/reader-controls';
import { ReaderToolkit } from '@/components/reader-toolkit';
import { AudioPlayer } from '@/components/audio-player';
import { KeepOffline } from '@/components/keep-offline';
import { canUseSoulAI } from '@/lib/ai/access';
import { StoryHero } from '@/components/story-hero';
import { getListeningPosition } from '@/lib/library';
import { track } from '@/lib/analytics';
import { getViewer } from '@/lib/auth';
import { getEntriesForStory } from '@/lib/journal';
import { formatDate } from '@/lib/format';

/*
 * The reader.
 *
 * Brief §7: this should feel like a digital book, not a webpage. The
 * concrete decisions that follow from that:
 *
 *   - The measure is fixed at ~34rem regardless of viewport. Long lines
 *     are the single biggest thing that makes long-form reading feel like
 *     a website.
 *   - Nothing floats over the text while reading. Controls live in a bar
 *     that is part of the page, not a sticky overlay.
 *   - Reading time and progress are shown; nothing else competes.
 *   - Related stories and the journal prompt come *after* the ending,
 *     never beside it.
 *
 * Paywall note: for a premium story this component receives no body at
 * all — the content layer omits it server-side. There is no hidden text
 * in the DOM to unlock with a devtools inspector.
 */

/*
 * Rendered per request, not prerendered.
 *
 * The prose is the same for everybody; the page is not. Whether the
 * story is locked, whether you have saved it, how far you had read —
 * all of that is yours. One cached copy per URL serves whichever
 * version happened to be built first.
 *
 * Concretely: prerendering happens with no session, so a premium story
 * bakes in its paywall, and a Resident who is paying for that story
 * would be handed the wall. Not a leak — migration 0015 means the body
 * is never in that HTML to begin with — but a paying reader locked out
 * of what they bought.
 *
 * It was static while the demo store made every visitor identical. A
 * real session ends that. The listings around it stay static, because
 * those genuinely are the same for everybody.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const stories = await getStories();
  const story = stories.find((s) => s.slug === slug);
  if (!story) return { title: 'Story not found' };

  return {
    title: story.title,
    description: story.subtitle,
    alternates: { canonical: `/story/${story.slug}` },
    openGraph: {
      type: 'article',
      title: `${story.title} · Soulfables`,
      description: story.subtitle,
      url: `/story/${story.slug}`,
      authors: [story.author],
    },
    twitter: { card: 'summary_large_image', title: story.title, description: story.subtitle },
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  /*
   * Record the open, and do not wait for it.
   *
   * This is what gives the dashboard a real views-over-time series.
   * story.view_count is a running total with no history, so a chart
   * drawn from it would be a drawing rather than a measurement.
   *
   * Not awaited on purpose: a story must not be slower to open, or
   * fail to open, because counting was slow or failed. The page is
   * rendered per request, so this fires once per actual read.
   */
  void track('story_opened', {
    entityType: 'story',
    entityId: story.id,
    properties: { slug: story.slug, access: story.access, locked: story.locked },
  });

  const viewer = await getViewer();
  const [shelf, stories, resumeAt, reflections] = await Promise.all([
    story.shelf ? getShelf(story.shelf) : Promise.resolve(null),
    getStories(),
    // Most stories have no narration; do not read a session to find that out.
    story.audio && !story.locked
      ? getListeningPosition(story.slug)
      : Promise.resolve(0),
    // The reader's own words about this story, for the foot of the page.
    viewer ? getEntriesForStory({ id: story.id, slug: story.slug }) : Promise.resolve([]),
  ]);
  const related = stories
    .filter((s) => s.slug !== slug && s.shelf === story.shelf)
    .slice(0, 2);

  // The byline leads to the writer's page, when they have one.
  const authorSlug = (await getResidents()).find((a) => a.name === story.author)?.slug ?? null;
  // Keeping a story offline is Premium; the button only appears for them.
  const offline = !story.locked && (await canUseSoulAI());

  // Structured data so a story is a first-class Article in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: story.title,
    description: story.subtitle,
    author: { '@type': 'Person', name: story.author },
    publisher: { '@type': 'Organization', name: 'Soulfables' },
    isAccessibleForFree: story.access === 'free',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Full width, so the artwork can be the room the story is read in. */}
      <StoryHero
        story={story}
        shelf={shelf}
        authorHref={authorSlug ? `/author/${authorSlug}` : undefined}
        listen={
          story.audio && !story.locked
            ? {
                minutes: story.audio.durationSeconds ? Math.max(1, Math.round(story.audio.durationSeconds / 60)) : null,
                locked: story.audio.locked,
                reason: story.audio.reason,
              }
            : null
        }
      />

      <article className="mx-auto max-w-content px-5 sm:px-8">
        {story.series && (
          <p className="mx-auto mt-6 max-w-measure font-ui text-xs text-grey-muted">
            {story.series.episode ? `Episode ${story.series.episode} of ` : 'Part of '}
            <Link href={`/series/${story.series.slug}` as Route} className="text-gold transition-colors hover:text-gold-soft">
              {story.series.title}
            </Link>
          </p>
        )}
        <ReaderControls />

        {story.audio && !story.locked && !story.audio.locked && (
          <div className="pt-8">
            <AudioPlayer
              storyId={story.id ?? `demo-${story.slug}`}
              src={story.audio.src}
              narrator={story.audio.narrator}
              isPlaceholder={story.audio.isPlaceholder}
              generated={story.audio.generated}
              resumeAt={resumeAt}
            />
          </div>
        )}

        {/* Narration exists and is withheld. Say why, rather than nothing. */}
        {story.audio?.locked && !story.locked && (
          <div className="pt-8">
            <div className="mx-auto flex max-w-measure flex-wrap items-center justify-between gap-4 border border-gold/25 bg-gold-dim px-5 py-4">
              <p className="font-ui text-sm text-ivory">
                This story is narrated{story.audio.narrator ? ` by ${story.audio.narrator}` : ''}.
                <span className="text-grey-muted">
                  {story.audio.reason === 'paid'
                    ? ' Listening comes with the book.'
                    : story.audio.reason === 'sign_in'
                    ? ' Sign in to listen; Free readers may listen to a few narrated stories a month.'
                    : story.audio.reason === 'allowance'
                      ? ' You have listened to your narrated stories for this month. Premium listens without limit.'
                      : ' Listening to this one is for Premium.'}
                </span>
              </p>
              <Link
                href={story.audio.reason === 'sign_in' ? `/signin?next=/story/${story.slug}` : story.audio.reason === 'paid' && story.product ? `/shop/${story.product.slug}` : '/membership'}
                className="font-ui text-xs uppercase tracking-[0.16em] text-gold transition-colors hover:text-gold-soft"
              >
                {story.audio.reason === 'sign_in' ? 'Sign in →' : story.audio.reason === 'paid' ? 'Buy the book →' : 'See Premium →'}
              </Link>
            </div>
          </div>
        )}
        {story.earlyAccess && (
          <p className="mx-auto mt-8 max-w-measure border-l-2 border-gold/50 pl-4 font-ui text-xs text-grey-muted">
            <span className="text-gold">Early access.</span> This story is yours before its day
            {story.scheduledFor ? `: it opens to everyone on ${new Date(story.scheduledFor).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}` : ''}.
          </p>
        )}

        <div className="mx-auto py-12">
          {story.locked || !story.body ? (
            <Paywall title={story.title} product={story.access === 'paid' ? (story.product ?? null) : null} />
          ) : (
            <StoryBody body={story.body} />
          )}
        </div>

        <footer className="border-t border-rule py-16 text-center">
          <p className="font-display text-2xl italic text-grey-muted">
            Every soul has a story.
          </p>

          <div className="mt-10">
            {story.id && !story.locked && (
              <ReaderToolkit
                storyId={story.id}
                storySlug={story.slug}
                sections={story.sections}
              />
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {offline && (
              <KeepOffline pageUrl={`/story/${story.slug}`} audioUrl={story.audio && !story.audio.locked ? story.audio.src : null} />
            )}
            <Link
              href={`/journal?story=${story.slug}`}
              className="border border-gold/40 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
            >
              Write about this
            </Link>
            {shelf && (
              <Link
                href={`/shelf/${shelf.slug}`}
                className="border border-rule px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-grey-muted transition-all duration-base ease-house hover:border-ivory/30 hover:text-ivory"
              >
                Back to {shelf.label}
              </Link>
            )}
          </div>
        </footer>

        {/*
          Your own words, beside the story that caused them. Reread it a
          month on and here is what it did to you the first time. Only
          the reader's own — RLS makes sure of that — and only when there
          are any: an empty box about yourself is not an invitation.
        */}
        {reflections.length > 0 && (
          <section className="border-t border-rule py-14">
            <p className="sf-eyebrow text-center">What you wrote after reading this</p>
            <ul className="mx-auto mt-8 max-w-measure space-y-6">
              {reflections.map((r) => (
                <li key={r.id} className="border-l-2 border-gold/40 pl-5">
                  {r.title && <p className="font-display text-xl text-ivory">{r.title}</p>}
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap font-reading text-base italic leading-relaxed text-grey">
                    {r.body}
                  </p>
                  <p className="mt-2 font-ui text-xs text-grey-muted">
                    {formatDate(r.createdAt)}
                    {r.moodLabel && <> · {r.moodLabel}</>}
                    {r.sectionTitle && <> · {r.sectionTitle}</>}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center">
              <Link
                href="/journal"
                className="font-ui text-sm text-gold transition-colors hover:text-gold-soft"
              >
                Open your journal →
              </Link>
            </p>
          </section>
        )}
      </article>

      {related.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <p className="sf-eyebrow mb-8 text-center">Readers also stayed for</p>
          <ul className="grid gap-px bg-rule sm:grid-cols-2">
            {related.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/story/${s.slug}`}
                  className="group block h-full bg-ink p-8 transition-colors duration-base ease-house hover:bg-ink-raised"
                >
                  <h3 className="font-display text-2xl font-light text-ivory transition-colors duration-base group-hover:text-gold">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-sm leading-normal text-grey-muted">
                    {s.subtitle}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * The premium wall. Shows the promise, never the prose — the body never
 * reached the browser to begin with.
 */
function Paywall({ title, product }: { title: string; product: { slug: string; priceLabel: string } | null }) {
  return (
    <div className="mx-auto max-w-measure border border-gold/25 bg-gold-dim p-10 text-center">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-5">{product ? 'A book from the House' : 'For Premium'}</p>
      <h2 className="mt-4 font-display text-3xl font-light text-ivory">
        {product ? <>“{title}” is a book from the House.</> : <>“{title}” is kept for Premium readers.</>}
      </h2>
      <p className="mx-auto mt-5 text-sm leading-normal text-grey-muted">
        {product
          ? `Buy it for ${product.priceLabel} and it opens here, in your library, the moment payment clears — or read everything with Premium.`
          : 'Premium readers have the run of the House — every story, the narrated editions, the companion, and what is coming before its day.'}</p>
      <Link
        href={(product ? `/shop/${product.slug}` : '/membership') as Route}
        className="mt-8 inline-block border border-gold/50 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
      >
        {product ? `Buy it · ${product.priceLabel}` : 'Become Premium'}
      </Link>
    </div>
  );
}

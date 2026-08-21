import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStories, getStory, getShelf } from '@/lib/content';
import { StoryBody } from '@/lib/story-body';
import { ReaderControls } from '@/components/reader-controls';
import { StoryActions } from '@/components/story-actions';

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

export const revalidate = 300;

export async function generateStaticParams() {
  const stories = await getStories();
  return stories.map((s) => ({ slug: s.slug }));
}

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

  const [shelf, stories] = await Promise.all([
    story.shelf ? getShelf(story.shelf) : Promise.resolve(null),
    getStories(),
  ]);
  const related = stories
    .filter((s) => s.slug !== slug && s.shelf === story.shelf)
    .slice(0, 2);

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

      <article className="mx-auto max-w-content px-5 sm:px-8">
        <header className="pb-14 pt-20 text-center">
          {shelf && (
            <Link
              href={`/shelf/${shelf.slug}`}
              className="sf-eyebrow transition-colors duration-base ease-house hover:text-gold"
            >
              {shelf.emoji} {shelf.label}
            </Link>
          )}
          <h1 className="mt-6 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
            {story.title}
          </h1>
          <p className="mx-auto mt-5 max-w-measure font-display text-xl italic leading-snug text-grey-muted">
            {story.subtitle}
          </p>
          <p className="mt-8 font-ui text-sm text-grey-muted">
            By {story.author} · ☕ {story.readingMinutes} min
          </p>
        </header>

        <ReaderControls />

        <div className="mx-auto py-12">
          {story.locked || !story.body ? (
            <Paywall title={story.title} />
          ) : (
            <StoryBody body={story.body} />
          )}
        </div>

        <footer className="border-t border-rule py-16 text-center">
          <p className="font-display text-2xl italic text-grey-muted">
            Every soul has a story.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {story.id && (
              <StoryActions storyId={story.id} storySlug={story.slug} />
            )}
            <Link
              href="/journal"
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
function Paywall({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-measure border border-gold/25 bg-gold-dim p-10 text-center">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-5">For Residents</p>
      <h2 className="mt-4 font-display text-3xl font-light text-ivory">
        “{title}” is kept for Residents.
      </h2>
      <p className="mx-auto mt-5 text-sm leading-normal text-grey-muted">
        Residents have the run of the House — every story, the narrated
        editions, and the companion.
      </p>
      <Link
        href="/shop"
        className="mt-8 inline-block border border-gold/50 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
      >
        Become a Resident
      </Link>
    </div>
  );
}

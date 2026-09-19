import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { getStories } from '@/lib/content';
import { getViewer, isStaff } from '@/lib/auth';
import { hasPremiumAccess } from '@/lib/membership';
import { StoryTile } from '@/components/library/story-tile';

export const metadata: Metadata = {
  title: 'Sleep Stories',
  description: 'Stories read slowly for the night, with a timer that lets the voice go quiet on its own.',
};

export const dynamic = 'force-dynamic';

/**
 * Sleep stories: narrated, slow, for the night.
 *
 * The page is open to everyone, so a reader can see what is here; the
 * listening is for Premium, and every player carries a sleep timer that
 * fades the voice out and stops.
 */
export default async function SleepPage() {
  const [stories, viewer] = await Promise.all([getStories(), getViewer()]);
  const premium = viewer ? isStaff(viewer.role) || (await hasPremiumAccess()) : false;
  const sleep = stories.filter((s) => s.forSleep && s.hasAudio);

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">For the night</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">Sleep Stories</h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Read slowly, with nowhere to get to. Set the timer on the player and the voice goes quiet on
          its own. Listening is for Premium.
        </p>
        {!premium && (
          <Link
            href={'/membership' as Route}
            className="mt-7 inline-block border border-gold/50 px-7 py-3 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            See Premium
          </Link>
        )}
      </header>

      {sleep.length === 0 ? (
        <p className="mx-auto mt-16 max-w-measure text-center font-display text-xl italic text-grey-muted">
          The night shelf is being read. The first sleep story arrives soon.
        </p>
      ) : (
        <ul className="mt-14 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {sleep.map((story) => (
            <li key={story.slug} className="bg-ink">
              <StoryTile story={story} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

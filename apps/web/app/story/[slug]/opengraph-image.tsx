import { getStories, getShelves } from '@/lib/content';
import { shareCard, SHARE_SIZE, SHARE_TYPE } from '@/components/share-card';

export const runtime = 'nodejs';
export const size = SHARE_SIZE;
export const contentType = SHARE_TYPE;
export const alt = 'A story from Soulfables';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [stories, shelves] = await Promise.all([getStories(), getShelves()]);
  const story = stories.find((s) => s.slug === slug);
  const shelf = story ? shelves.find((s) => s.slug === story.shelf) : null;
  return shareCard({
    eyebrow: shelf ? `Soulfables · ${shelf.label}` : 'Soulfables',
    title: story?.title ?? 'Soulfables',
    subtitle: story?.subtitle ?? null,
    cover: story?.coverImage ?? null,
    footer: story ? `By ${story.author} · ${story.readingMinutes} min` : undefined,
  });
}

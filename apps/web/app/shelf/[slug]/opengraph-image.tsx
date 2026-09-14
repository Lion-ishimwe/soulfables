import { getShelves, getStories } from '@/lib/content';
import { shareCard, SHARE_SIZE, SHARE_TYPE } from '@/components/share-card';

export const runtime = 'nodejs';
export const size = SHARE_SIZE;
export const contentType = SHARE_TYPE;
export const alt = 'A shelf of the Soulfables library';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [shelves, stories] = await Promise.all([getShelves(), getStories()]);
  const shelf = shelves.find((s) => s.slug === slug);
  const n = stories.filter((s) => s.shelf === slug).length;
  return shareCard({
    eyebrow: 'Soulfables · The Library of Feelings',
    title: shelf?.title ?? 'The Library',
    subtitle: shelf?.tagline ?? null,
    footer: n ? `${n} ${n === 1 ? 'story' : 'stories'} on this shelf` : undefined,
  });
}

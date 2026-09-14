import { shareCard, SHARE_SIZE, SHARE_TYPE } from '@/components/share-card';

export const runtime = 'nodejs';
export const size = SHARE_SIZE;
export const contentType = SHARE_TYPE;
export const alt = 'Soulfables — every soul has a story';

export default function Image() {
  return shareCard({
    eyebrow: 'Soulfables',
    title: 'How is your heart today?',
    subtitle: 'Modern folktales about love, loss, healing, identity, hope, and becoming.',
  });
}

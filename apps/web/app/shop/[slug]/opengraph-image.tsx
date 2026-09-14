import { getProducts } from '@/lib/content';
import { shareCard, SHARE_SIZE, SHARE_TYPE } from '@/components/share-card';

export const runtime = 'nodejs';
export const size = SHARE_SIZE;
export const contentType = SHARE_TYPE;
export const alt = 'From the Soulfables Bookshop';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = (await getProducts()).find((p) => p.slug === slug);
  return shareCard({
    eyebrow: 'Soulfables · The Bookshop',
    title: product?.title ?? 'The Bookshop',
    subtitle: product?.subtitle ?? null,
    cover: product?.coverImage ?? null,
    footer: product?.priceLabel ? `${product.priceLabel} · yours to keep` : undefined,
  });
}

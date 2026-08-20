import type { MetadataRoute } from 'next';
import { getShelves, getStories, getProducts } from '@/lib/content';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

/**
 * Every published story, shelf and product is listed. Brief §19: stories
 * must be indexable, and a premium story is listed here too — its blurb
 * is public even though its body is not.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [shelves, stories, products] = await Promise.all([
    getShelves(),
    getStories(),
    getProducts(),
  ]);

  const staticRoutes = ['', '/library', '/shelves', '/shop', '/letter', '/about'].map(
    (path) => ({
      url: `${SITE}${path}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    }),
  );

  return [
    ...staticRoutes,
    ...shelves.map((s) => ({
      url: `${SITE}/shelf/${s.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...stories.map((s) => ({
      url: `${SITE}/story/${s.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...products.map((p) => ({
      url: `${SITE}/shop/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}

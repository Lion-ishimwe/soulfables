import type { MetadataRoute } from 'next';
import { getShelves, getStories, getProducts, getResidents } from '@/lib/content';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

/**
 * Every published story, shelf, product and writer is listed. Brief §19:
 * stories must be indexable, and a premium story is listed here too —
 * its blurb is public even though its body is not.
 *
 * Dates are real or absent. A page that has not changed does not claim
 * to have changed today; a story carries the day it was published.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [shelves, stories, products, authors] = await Promise.all([
    getShelves(),
    getStories(),
    getProducts(),
    getResidents(),
  ]);

  const staticRoutes = [
    { path: '', priority: 1 },
    { path: '/library', priority: 0.9 },
    { path: '/shelves', priority: 0.8 },
    { path: '/wander', priority: 0.6 },
    { path: '/shop', priority: 0.8 },
    { path: '/letter', priority: 0.6 },
    { path: '/questions', priority: 0.6 },
    { path: '/residents', priority: 0.5 },
    { path: '/membership', priority: 0.6 },
    { path: '/about', priority: 0.5 },
    { path: '/support', priority: 0.3 },
    { path: '/privacy', priority: 0.2 },
    { path: '/terms', priority: 0.2 },
  ].map(({ path, priority }) => ({
    url: `${SITE}${path}`,
    changeFrequency: 'weekly' as const,
    priority,
  }));

  return [
    ...staticRoutes,
    ...shelves.map((s) => ({
      url: `${SITE}/shelf/${s.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...stories.map((s) => ({
      url: `${SITE}/story/${s.slug}`,
      ...(s.publishedAt ? { lastModified: new Date(s.publishedAt) } : {}),
      changeFrequency: 'monthly' as const,
      priority: 0.9,
    })),
    ...products.map((p) => ({
      url: `${SITE}/shop/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...authors.map((a) => ({
      url: `${SITE}/author/${a.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}

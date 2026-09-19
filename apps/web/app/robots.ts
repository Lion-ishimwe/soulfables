import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private surfaces. The journal in particular must never be crawled.
      // Wander is a page of links to itself, chosen afresh each time: a
      // crawler that follows them never finishes. GPTBot walked it for
      // four days at two hundred requests a minute.
      disallow: ['/admin', '/account', '/journal', '/auth', '/api', '/wander', '/search'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}

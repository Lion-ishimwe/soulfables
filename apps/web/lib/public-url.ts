import type { NextRequest } from 'next/server';

/**
 * The address a visitor actually came through.
 *
 * Behind nginx the app only knows itself as 127.0.0.1:3000, and
 * request.nextUrl says so: it is built from the server's own listening
 * address, not from the visitor's. A redirect cloned from it sent every
 * signed-out reader who opened the journal on the live site to
 * localhost:3000 — an address that exists only on the developer's
 * laptop.
 *
 * nginx forwards the real host and scheme as headers, so those are what
 * a redirect is built from here, with the request's own origin as the
 * fallback for local development where there is no proxy. Safe to use
 * in middleware: nothing here needs Node.
 */
export function publicUrl(
  request: NextRequest,
  pathname: string,
  params?: Record<string, string>,
): URL {
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? request.nextUrl.host;
  const proto =
    request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '');

  const url = new URL(pathname, `${proto}://${host}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
  return url;
}

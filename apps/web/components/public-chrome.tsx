'use client';

import { usePathname } from 'next/navigation';

/**
 * Keeps the public header and footer off the admin surface.
 *
 * Admin is a route group inside the public app — one session, one RLS
 * surface — which is the right trade, but it means the root layout wraps
 * it too. The result was a dashboard with the reader's navigation above
 * it and the site's four-column footer below it, so the page had two
 * footers and two identities.
 *
 * A route group would express this in the file tree rather than at
 * runtime, and is the better answer eventually. It is also a directory
 * move across forty routes, and this is four lines.
 *
 * Children may be server components; passing them through a client
 * boundary as children keeps them rendering on the server.
 */
export function PublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  return <>{children}</>;
}

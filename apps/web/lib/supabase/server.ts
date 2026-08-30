import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Request-scoped Supabase client for React Server Components and route
 * handlers.
 *
 * This client carries the reader's session, which means every query it
 * makes is subject to RLS. That is the point: a bug in a page component
 * cannot read another reader's rows, because the database refuses.
 *
 * For anything that must bypass RLS — granting entitlements, minting
 * signed download URLs, processing a webhook — use `./admin`, and read
 * the warning at the top of that file first.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead; ignoring
            // this is the documented Supabase SSR pattern.
          }
        },
      },
    },
  );
}

/**
 * Anonymous client, for content that is the same for everybody.
 *
 * The shelf and story pages are statically prerendered. `cookies()` does
 * not exist at build time, so a client that reads them throws
 * "`cookies` was called outside a request scope" and the whole page
 * 500s — which is what happened the first time these pages ran against a
 * real database rather than the demo store.
 *
 * This client has no session, so it queries as `anon` and RLS shows it
 * exactly what a stranger may see: published stories, shelves, products.
 * That is not a weaker guarantee than `createClient` — it is the same
 * one, evaluated for a viewer who is nobody.
 *
 * Use it for public reads. Anything that depends on WHO is asking —
 * entitlements, journal, library — must use `createClient`, and that
 * page must not be static.
 */
export function createPublicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No session to persist. Deliberately does nothing.
        },
      },
    },
  );
}

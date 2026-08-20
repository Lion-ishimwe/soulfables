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

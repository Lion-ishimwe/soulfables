import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware does two jobs.
 *
 * 1. Refreshes the Supabase session on every request. Server Components
 *    cannot write cookies, so without this a reader's session would
 *    silently expire mid-visit.
 *
 * 2. Guards the private areas. Note what this is and is not: a redirect
 *    for people who are not signed in, so they see a sign-in page instead
 *    of an empty screen. It is NOT the security boundary — that is Row
 *    Level Security in the database. If this middleware were deleted
 *    entirely, an unauthorised visitor would reach a page that renders
 *    nothing, because the queries behind it would return no rows.
 */

/** Requires any signed-in reader. */
const PRIVATE_PREFIXES = ['/account', '/journal'] as const;

/** Requires an editor, admin, or owner. */
const STAFF_PREFIXES = ['/admin'] as const;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // When Supabase is not configured (local design work), do nothing
  // rather than crash every request.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalidates against the auth server. getSession() only reads
  // the cookie, which a client could have tampered with — never use it here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsUser = PRIVATE_PREFIXES.some((p) => path.startsWith(p));
  const needsStaff = STAFF_PREFIXES.some((p) => path.startsWith(p));

  if ((needsUser || needsStaff) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    // Send them back where they were headed once they are through the door.
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  if (needsStaff && user) {
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!role || !['editor', 'admin', 'owner'].includes(role.role)) {
      // Not "forbidden" — the House does not confirm that /admin exists
      // to someone who has no business there.
      const url = request.nextUrl.clone();
      url.pathname = '/404';
      return NextResponse.rewrite(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. Auth cookies must
     * refresh on real page requests, not on every icon fetch.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2?)$).*)',
  ],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { publicUrl } from '@/lib/public-url';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware does two jobs.
 *
 * 1. Keeps the session fresh — a Supabase token in live mode, or a demo
 *    session id in demo mode. Server Components cannot write cookies, so
 *    without this a reader's session would silently expire mid-visit and
 *    a demo visitor would never get their own House.
 *
 * 2. Guards the private areas. Note what this is and is not: a redirect
 *    for people who are not signed in, so they see a sign-in page instead
 *    of an empty screen. It is NOT the security boundary — in live mode
 *    that is Row Level Security. If this middleware were deleted, an
 *    unauthorised visitor would reach a page that renders nothing,
 *    because the queries behind it would return no rows.
 */

const PRIVATE_PREFIXES = ['/account', '/journal', '/studio'] as const;
const STAFF_PREFIXES = ['/admin'] as const;

const DEMO_ID_COOKIE = 'sf-demo-id';
const DEMO_SIGNED_COOKIE = 'sf-demo-signed';

const demoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
  !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsUser = PRIVATE_PREFIXES.some((p) => path.startsWith(p));
  const needsStaff = STAFF_PREFIXES.some((p) => path.startsWith(p));

  // ------------------------------------------------------------------
  // Demo mode
  // ------------------------------------------------------------------
  if (demoMode) {
    const response = NextResponse.next({ request });

    // Give every browser its own House on first contact, so a shared
    // demo link never shows one visitor another's journal.
    if (!request.cookies.get(DEMO_ID_COOKIE)) {
      response.cookies.set(DEMO_ID_COOKIE, `demo-${crypto.randomUUID()}`, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24,
      });
    }

    const signedIn = request.cookies.get(DEMO_SIGNED_COOKIE)?.value === '1';

    if ((needsUser || needsStaff) && !signedIn) {
      return NextResponse.redirect(publicUrl(request, '/signin', { next: path }));
    }

    return response;
  }

  // ------------------------------------------------------------------
  // Live mode
  // ------------------------------------------------------------------
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  /*
   * Both at once, not one after the other.
   *
   * getUser() revalidates against the auth server. getSession() only
   * reads the cookie, which a client could have tampered with — never
   * use it here.
   *
   * The role lookup used to wait for that answer so it could use
   * user.id. It does not need to: viewer_context() reads auth.uid() from
   * the same JWT, so both questions can be asked at once and the answers
   * checked together. From 300ms away that is the difference between one
   * round trip and two, on every admin request.
   */
  /*
   * Skip the auth server entirely for visitors who have no session.
   *
   * Most traffic is anonymous and most routes are public, and asking
   * GoTrue to identify somebody who has not signed in costs a round trip
   * to Frankfurt to learn nothing. A missing cookie cannot be a valid
   * session; a forged one still fails verification below.
   */
  const hasSession = request.cookies
    .getAll()
    .some((c) => /^sb-.*-auth-token/.test(c.name));

  const [{ data: { user } }, context] = hasSession
    ? await Promise.all([
        supabase.auth.getUser(),
        needsStaff ? supabase.rpc('viewer_context') : Promise.resolve({ data: null }),
      ])
    : [{ data: { user: null } }, { data: null }];

  if ((needsUser || needsStaff) && !user) {
    return NextResponse.redirect(publicUrl(request, '/signin', { next: path }));
  }

  if (needsStaff && user) {
    const role = (context?.data ?? null) as { role?: string } | null;

    if (!role?.role || !['editor', 'admin', 'owner'].includes(role.role)) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2?)$).*)',
  ],
};

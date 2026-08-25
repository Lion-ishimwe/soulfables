import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
      const url = request.nextUrl.clone();
      url.pathname = '/signin';
      url.searchParams.set('next', path);
      return NextResponse.redirect(url);
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

  // getUser() revalidates against the auth server. getSession() only reads
  // the cookie, which a client could have tampered with — never use it here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if ((needsUser || needsStaff) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2?)$).*)',
  ],
};

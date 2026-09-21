import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Universal links for the iOS app.
 *
 * When this file names the app, an iPhone with it installed opens
 * soulfables.co/story/… and the emailed sign-in links in the app rather
 * than the browser. It is served only once the two values are set in
 * Parameter Store, so until the Apple Developer account exists the
 * address answers "not found" and nothing changes for the web.
 *
 *   APP_IOS_TEAM_ID    the ten-character Apple team id
 *   APP_IOS_BUNDLE_ID  e.g. co.soulfables.app
 */
export async function GET() {
  const team = process.env.APP_IOS_TEAM_ID;
  const bundle = process.env.APP_IOS_BUNDLE_ID;
  if (!team || !bundle) return new NextResponse(null, { status: 404 });
  const appID = `${team}.${bundle}`;
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [appID],
            components: [
              { '/': '/story/*' },
              { '/': '/auth/confirm', '?': { token_hash: '*' } },
              { '/': '/library' },
              { '/': '/shelf/*' },
              { '/': '/community/*' },
            ],
          },
        ],
      },
      webcredentials: { apps: [appID] },
    },
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  );
}

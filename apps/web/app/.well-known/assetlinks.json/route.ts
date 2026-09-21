import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * App links for the Android app, the counterpart of the Apple file.
 *
 *   APP_ANDROID_PACKAGE  e.g. co.soulfables.app
 *   APP_ANDROID_SHA256   the signing certificate fingerprint, colon-separated,
 *                        as the Play Console shows it. Several may be given
 *                        separated by commas (debug and release).
 */
export async function GET() {
  const pkg = process.env.APP_ANDROID_PACKAGE;
  const sha = process.env.APP_ANDROID_SHA256;
  if (!pkg || !sha) return new NextResponse(null, { status: 404 });
  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: sha.split(',').map((s) => s.trim()).filter(Boolean),
        },
      },
    ],
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } },
  );
}

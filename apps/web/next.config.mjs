import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Read .env.local from the repository root.
 *
 * Next loads .env files relative to its own directory, which in a
 * workspace is apps/web. The database scripts, which are not Next, read
 * the repository root. Left alone that means two files holding the same
 * secrets, and the day they disagree the app and the migrations are
 * pointed at different databases.
 *
 * So there is one file, at the root, and this teaches Next where it is.
 * Anything already set in the real environment wins, because that is how
 * a deployment overrides a local file.
 */
function loadRootEnv() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

  for (const name of ['.env.local', '.env']) {
    const file = join(root, name);
    if (!existsSync(file)) continue;

    const raw = readFileSync(file);

    // PowerShell's >> writes UTF-16, which parses as nothing useful.
    // Silence here would look exactly like missing credentials.
    if (raw[0] === 0xff || raw[0] === 0xfe) {
      throw new Error(`${name} is UTF-16. Rewrite it with: npm run db:setup`);
    }

    for (const line of raw.toString('utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eq = trimmed.indexOf('=');
      if (eq < 1) continue;

      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;

      process.env[key] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');
    }
  }
}

loadRootEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /*
   * Where the build lands.
   *
   * `next build` writes into .next, and `next start` serves from .next —
   * the same directory. On the server that meant several minutes of
   * every deploy during which the running site was serving a half-
   * written build: anyone with a tab open got a client-side exception,
   * and forms posted to server actions that no longer existed. deploy.sh
   * now builds into a sibling directory named here and swaps it into
   * place in one rename. The service itself never sets this, so it keeps
   * reading .next.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Workspace packages ship TypeScript source, not a build step.
  transpilePackages: ['@soulfables/design-system', '@soulfables/models', '@soulfables/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  typedRoutes: true,
  /*
   * Covers and backdrops arrive through a server action, and Next refuses
   * any action body over 1 MB unless told otherwise. A phone photograph
   * is three or four, so every real cover was being turned away with a
   * 413 the form never saw. Ten matches nginx's client_max_body_size;
   * the action itself still stops at eight.
   */
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  /*
   * The headers a browser reads before it reads the page. nginx sets
   * only the two it owns; the rest describe the application and live
   * with it. The content policy names what the House loads and nothing
   * else: itself, its database's storage, and the payment page it
   * sends buyers to. Inline scripts are allowed because Next needs
   * them; eval only in development, where the dev tooling needs it.
   */
  async headers() {
    const dev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "form-action 'self' https://www.paypal.com https://www.sandbox.paypal.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join('; ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // Meaningful once the House is on HTTPS; harmless before.
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};
export default nextConfig;

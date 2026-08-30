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
  // Workspace packages ship TypeScript source, not a build step.
  transpilePackages: ['@soulfables/design-system', '@soulfables/models', '@soulfables/shared'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: '**.supabase.co' }],
  },
  typedRoutes: true,
};
export default nextConfig;

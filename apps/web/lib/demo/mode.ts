/**
 * Demo mode.
 *
 * The platform runs in one of two modes, and it decides by itself:
 *
 *   live — Supabase credentials are present. Every read and write goes to
 *          Postgres, RLS applies, auth is real.
 *   demo — no credentials. Content comes from lib/demo/content.ts and
 *          writes go to an in-process store that resets when the server
 *          restarts.
 *
 * The point of doing it this way rather than with a separate demo build:
 * the pages, components and server actions are identical in both modes.
 * There is no demo fork to keep in sync, and nothing to unpick when the
 * database arrives — the switch simply stops flipping.
 *
 * `NEXT_PUBLIC_DEMO_MODE=true` forces demo mode even where credentials
 * exist, which is what a public showcase deployment should set.
 */

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true;

  return !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isLive(): boolean {
  return !isDemoMode();
}

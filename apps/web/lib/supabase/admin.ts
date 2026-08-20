import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * ⚠ SERVICE ROLE CLIENT — BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Every RLS policy in the database is inert for this client. It exists
 * for exactly four jobs, and nothing else should import it:
 *
 *   1. Webhook handlers marking an order paid and granting entitlements.
 *   2. Minting signed download URLs after an entitlement check.
 *   3. Scheduled jobs (embeddings, recomputing the journey graph, sends).
 *   4. Admin actions that are written to audit_log in the same transaction.
 *
 * Rules for using it:
 *   - Never import this into a Client Component. The `server-only` import
 *     above makes that a build error rather than a leaked key.
 *   - Never pass a user-supplied id straight into a query. Check
 *     authorisation explicitly first — RLS is not there to catch you.
 *   - Every call that changes state on a reader's behalf writes an
 *     audit_log row.
 *
 * The key itself is never exposed to the browser: it has no NEXT_PUBLIC_
 * prefix, so Next will refuse to inline it into client bundles.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Service role client requested but SUPABASE_SERVICE_ROLE_KEY is not set.',
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'soulfables-admin' } },
  });
}

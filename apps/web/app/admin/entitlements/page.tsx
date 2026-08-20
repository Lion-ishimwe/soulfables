import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { isConfigured } from '@/lib/admin-data';
import { PageHeader, NotConnected, EmptyState } from '@/components/admin/ui';
import { GrantForm } from '@/components/admin/grant-form';
import { revokeEntitlement } from '@/app/actions/entitlements';

export const metadata: Metadata = { title: 'Entitlements' };
export const dynamic = 'force-dynamic';

/**
 * Who owns what, and the control for granting access by hand.
 *
 * This is the surface that makes the clean-start decision workable:
 * customers who bought before this platform existed are given their books
 * here, deliberately, with a record of who did it.
 */
export default async function EntitlementsPage() {
  if (!isConfigured()) {
    return (
      <>
        <PageHeader title="Entitlements" />
        <NotConnected />
      </>
    );
  }

  const supabase = await createClient();

  const [{ data: products }, { data: grants }] = await Promise.all([
    supabase
      .from('products')
      .select('id, title')
      .eq('status', 'published')
      .order('sort_order'),
    supabase
      .from('entitlements')
      .select('id, source, granted_at, revoked_at, notes, user_id, products(title)')
      .order('granted_at', { ascending: false })
      .limit(100),
  ]);

  const options = (products ?? []).map((p) => ({
    value: p.id as string,
    label: p.title as string,
  }));

  const rows = grants ?? [];

  return (
    <>
      <PageHeader
        title="Entitlements"
        subtitle="Who has access to what. Granting here is how a customer who bought elsewhere gets their book."
      />

      <section className="mb-12 border border-rule p-6">
        <h2 className="sf-eyebrow mb-4">Give someone access</h2>
        <GrantForm products={options} />
      </section>

      <section>
        <h2 className="sf-eyebrow mb-4">Recent grants</h2>

        {rows.length === 0 ? (
          <EmptyState
            title="Nothing granted yet."
            body="Purchases create entitlements automatically. Grants made by hand — for customers who bought before this platform — appear here too."
          />
        ) : (
          <div className="overflow-x-auto border border-rule">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="sf-eyebrow px-5 py-3 text-left">Product</th>
                  <th className="sf-eyebrow px-5 py-3 text-left">Source</th>
                  <th className="sf-eyebrow px-5 py-3 text-left">Granted</th>
                  <th className="sf-eyebrow px-5 py-3 text-left">Note</th>
                  <th className="sf-eyebrow px-5 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {rows.map((g: Record<string, unknown>) => {
                  const revoked = Boolean(g.revoked_at);
                  return (
                    <tr key={g.id as string} className="hover:bg-ink-raised">
                      <td className="px-5 py-3 text-ivory">
                        {(g.products as { title?: string } | null)?.title ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`border px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${
                            g.source === 'manual'
                              ? 'border-gold/45 text-gold'
                              : 'border-rule-strong text-grey-muted'
                          }`}
                        >
                          {g.source as string}
                        </span>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-grey-muted">
                        {new Date(g.granted_at as string).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="max-w-xs truncate px-5 py-3 text-grey-muted">
                        {(g.notes as string) ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {revoked ? (
                          <span className="text-xs text-state-danger">Revoked</span>
                        ) : (
                          <form action={revokeEntitlement}>
                            <input type="hidden" name="entitlementId" value={g.id as string} />
                            <button
                              type="submit"
                              className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger"
                            >
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

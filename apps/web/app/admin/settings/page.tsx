import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { getHouseSettings } from '@/lib/settings';
import { isDemoMode } from '@/lib/demo/mode';
import { AdminPageHeader, Panel, StatusDot } from '@/components/admin/dashboard';
import { SettingsForm } from '@/components/admin/settings-form';
import { SettingsTabs } from '@/components/admin/settings-tabs';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/**
 * Settings, in two halves.
 *
 * Above: the handful of things about the House that were previously typed
 * into the pages that display them.
 *
 * Below: what is connected and what is not. That half is read-only and
 * exists because the answer was previously scattered across an .env file,
 * four adapters and a milestone list — so "can we take payments yet" was
 * a question you had to read source code to answer. It is now a row in a
 * table, and it says "not connected" plainly rather than implying that
 * silence means yes.
 */
export default async function SettingsPage() {
  await requireStaff();
  const settings = await getHouseSettings();

  /*
   * Read from the environment, on the server, and never rendered — only
   * whether each one is present. A settings page that prints an API key
   * to the screen is a settings page that leaks one over a shoulder.
   */
  const integrations = [
    {
      name: 'Database',
      detail: isDemoMode()
        ? 'Demo mode — content comes from fixtures and nothing is saved.'
        : 'Supabase. Every read and write goes through row level security.',
      connected: !isDemoMode(),
      required: true,
    },
    {
      name: 'Payments',
      detail: process.env.PAYMENT_API_KEY
        ? `Connected via ${process.env.PAYMENT_PROVIDER ?? 'stripe'}.`
        : 'Not connected. The shop is built; nothing can be bought until a provider key is set.',
      connected: Boolean(process.env.PAYMENT_API_KEY),
      required: false,
    },
    {
      name: 'Email',
      detail: process.env.EMAIL_PROVIDER_API_KEY
        ? 'Connected. Receipts, invitations and the weekly letter can be sent.'
        : 'Not connected. Invitations show a temporary password on screen instead of sending one.',
      connected: Boolean(process.env.EMAIL_PROVIDER_API_KEY),
      required: false,
    },
    {
      name: 'The Librarian',
      detail: process.env.AI_API_KEY
        ? `Connected via ${process.env.AI_PROVIDER ?? 'the configured provider'}.`
        : 'Not connected. The companion answers from its own rules, which is narrower but never invents a story.',
      connected: Boolean(process.env.AI_API_KEY),
      required: false,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6">
        <SettingsForm settings={settings} />
      </div>

      <Panel
        title="Connections"
        hint="Read-only. Set in the environment, not here."
      >
        <ul className="divide-y divide-rule/60">
          {integrations.map((i) => (
            <li
              key={i.name}
              className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm text-ivory">{i.name}</p>
                <p className="mt-1 max-w-prose font-ui text-xs leading-relaxed text-grey-muted">
                  {i.detail}
                </p>
              </div>

              <div className="shrink-0">
                {i.connected ? (
                  <StatusDot tone="active" label="Connected" />
                ) : i.required ? (
                  <StatusDot tone="none" label="Missing" />
                ) : (
                  <StatusDot tone="idle" label="Not connected" />
                )}
              </div>
            </li>
          ))}
        </ul>

        <p className="border-t border-rule px-5 py-4 font-ui text-micro leading-relaxed text-grey-faint">
          These come from environment variables and change with a deploy, not
          with a click. Keys are never shown here — only whether one is set.
        </p>
      </Panel>
    </>
  );
}

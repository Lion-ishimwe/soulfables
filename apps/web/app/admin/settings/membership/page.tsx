import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { getPlanPricing, priceLabel } from '@/lib/plans';
import { isPaymentsConfigured, paymentsDescription } from '@/lib/payments/provider';
import { AdminPageHeader, StatusDot } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { MembershipForm } from '@/components/admin/membership-form';

export const metadata: Metadata = { title: 'Membership' };
export const dynamic = 'force-dynamic';

/**
 * Settings → Membership: what Premium costs, and how it is sold.
 *
 * The price is the House's; the plan ids are PayPal's. Premium is on
 * sale only when both are here and the payment account is connected,
 * and the page says which of those is still missing.
 */
export default async function MembershipSettingsPage() {
  await requireStaff();
  const pricing = await getPlanPricing();
  const connected = isPaymentsConfigured();
  const onSale = isDemoMode() || (connected && Boolean(pricing.monthly.paypalPlanId));

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl text-ivory">Premium</h2>
          <p className="mt-2 font-ui text-sm leading-relaxed text-grey-muted">
            The subscription readers see on{' '}
            <Link href={'/membership' as Route} className="text-gold transition-colors hover:text-gold-soft">
              the membership page
            </Link>
            . Sold through PayPal subscriptions; a reader who stops keeps Premium until the period they
            paid for ends.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 font-ui text-xs text-grey-muted">
          <StatusDot tone={connected ? 'active' : 'idle'} label={connected ? `Payments: ${paymentsDescription()}` : 'Payments not connected'} />
          <StatusDot tone={onSale ? 'active' : 'idle'} label={onSale ? `On sale at ${priceLabel(pricing.monthly)} a month` : 'Not on sale yet'} />
        </div>
      </div>

      <div className="space-y-8">
        <MembershipForm
          readOnly={isDemoMode()}
          pricing={{
            monthlyMajor: (pricing.monthly.amount / 100).toFixed(2),
            yearlyMajor: (pricing.yearly.amount / 100).toFixed(2),
            currency: pricing.monthly.currency,
            monthlyPlanId: pricing.monthly.paypalPlanId ?? '',
            yearlyPlanId: pricing.yearly.paypalPlanId ?? '',
            freeAudioPerMonth: pricing.freeAudioPerMonth,
          }}
        />

        <div className="rounded-lg border border-rule bg-ink-raised px-6 py-6">
          <p className="sf-eyebrow">Connecting the plans at PayPal, once</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 font-ui text-sm leading-relaxed text-grey">
            <li>
              In the PayPal business dashboard, open <span className="text-ivory">Pay &amp; Get Paid → Subscriptions</span> (or
              Products in the developer dashboard). Create a product named <span className="text-ivory">Soulfables Premium</span>,
              type Digital, category Books.
            </li>
            <li>
              Add a plan to it: <span className="text-ivory">Monthly</span>, fixed price, the monthly amount above, billed every
              month, no trial. Copy its id, which begins <span className="text-ivory">P-</span>, into the monthly field.
            </li>
            <li>Add a second plan, yearly, the same way. Paste its id into the yearly field. Optional.</li>
            <li>
              On the webhook you already have, add these events:{' '}
              <span className="text-ivory">BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.UPDATED, BILLING.SUBSCRIPTION.CANCELLED,
              BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.EXPIRED, PAYMENT.SALE.COMPLETED</span>.
            </li>
            <li>Save here. The membership page goes on sale the moment a monthly id is in place.</li>
          </ol>
          <p className="mt-4 font-ui text-xs leading-relaxed text-grey-faint">
            The amounts here are what the House shows; the amounts PayPal charges are on the plans you
            created. Keep them the same. Sandbox and live plans are separate: create them again when you
            go live.
          </p>
        </div>
      </div>
    </>
  );
}

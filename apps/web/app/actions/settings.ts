'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createClient } from '@/lib/supabase/server';

export type SettingsResult = { error?: string; message?: string };

const schema = z.object({
  siteName: z.string().trim().min(1, 'The House needs a name.').max(80),
  tagline: z.string().trim().max(160),
  supportEmailGeneral: z
    .string()
    .trim()
    .toLowerCase()
    .email('That is not a valid address for general enquiries.'),
  supportEmailShop: z
    .string()
    .trim()
    .toLowerCase()
    .email('That is not a valid address for shop support.'),
  siteUrl: z
    .string()
    .trim()
    .url('That is not a valid URL. Include https://')
    .or(z.literal(''))
    .optional(),
  theme: z.enum(['dark', 'light']).default('dark'),
  legalName: z.string().trim().max(200).optional().or(z.literal('')),
  legalAddress: z.string().trim().max(600).optional().or(z.literal('')),
  vatNumber: z.string().trim().max(40).optional().or(z.literal('')),
  autoNarration: z.boolean().default(true),
});

/**
 * Save what the House says about itself.
 *
 * Staff only, and RLS says so as well — the policy on house_settings is
 * is_staff(), so a reader who reached this action anyway would still be
 * refused by the database.
 *
 * Both tags are busted: 'settings' for the pages that show these values
 * and 'content' because the support page carries them too.
 */
export async function saveHouseSettings(
  _prev: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const viewer = await requireStaff();

  const parsed = schema.safeParse({
    siteName: field(formData, 'siteName'),
    tagline: field(formData, 'tagline'),
    supportEmailGeneral: field(formData, 'supportEmailGeneral'),
    supportEmailShop: field(formData, 'supportEmailShop'),
    siteUrl: field(formData, 'siteUrl'),
    theme: field(formData, 'theme') || 'dark',
    legalName: field(formData, 'legalName'),
    legalAddress: field(formData, 'legalAddress'),
    vatNumber: field(formData, 'vatNumber'),
    autoNarration: checkbox(formData, 'autoNarration'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (isDemoMode()) {
    return {
      error:
        'Demo mode has no database to save to. Connect Supabase and these become editable.',
    };
  }

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from('house_settings')
    .update({
      site_name: d.siteName,
      tagline: d.tagline,
      support_email_general: d.supportEmailGeneral,
      support_email_shop: d.supportEmailShop,
      site_url: d.siteUrl || null,
      theme: d.theme,
      legal_name: d.legalName || null,
      legal_address: d.legalAddress || null,
      vat_number: d.vatNumber || null,
      auto_narration: d.autoNarration,
      // The column exists to answer "who changed the House's name".
      // Leaving it null makes that unanswerable.
      updated_by: viewer.id,
    })
    .eq('id', 1);

  if (error) return { error: error.message };

  revalidateTag('settings');
  revalidateTag('content');
  revalidatePath('/support');
  revalidatePath('/admin/settings');
  // The theme is an attribute on <html>, set by the root layout, so
  // every page has to be drawn again for a change to show.
  revalidatePath('/', 'layout');

  return { message: 'Saved. Readers see this everywhere it appears.' };
}

// ---------------------------------------------------------------------
// Settings → Membership: what Premium costs and how it is sold.
// ---------------------------------------------------------------------

const membershipSchema = z.object({
  monthly: z.coerce.number().min(0).max(100000),
  yearly: z.coerce.number().min(0).max(1000000),
  monthlyPlanId: z.string().trim().max(60).optional().or(z.literal('')),
  yearlyPlanId: z.string().trim().max(60).optional().or(z.literal('')),
  freeAudioPerMonth: z.coerce.number().int().min(0).max(1000),
});

export async function saveMembership(_prev: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const viewer = await requireStaff();
  const parsed = membershipSchema.safeParse({
    monthly: field(formData, 'monthly'),
    yearly: field(formData, 'yearly'),
    monthlyPlanId: field(formData, 'monthlyPlanId'),
    yearlyPlanId: field(formData, 'yearlyPlanId'),
    freeAudioPerMonth: field(formData, 'freeAudioPerMonth'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (isDemoMode()) return { error: 'The demo keeps its prices as they are.' };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: plan } = await supabase.from('plans').select('id').eq('slug', 'resident').single();
  if (!plan) return { error: 'The Premium plan row is missing.' };

  for (const [interval, amount, planId] of [
    ['month', Math.round(d.monthly * 100), d.monthlyPlanId || null],
    ['year', Math.round(d.yearly * 100), d.yearlyPlanId || null],
  ] as const) {
    const { data: existing } = await supabase
      .from('plan_prices')
      .select('id')
      .eq('plan_id', plan.id)
      .eq('interval', interval)
      .maybeSingle();
    const row = { plan_id: plan.id, currency: 'USD', unit_amount: amount, interval, provider: 'paypal', provider_price_id: planId, is_default: interval === 'month', is_active: true };
    const { error } = existing
      ? await supabase.from('plan_prices').update(row).eq('id', existing.id)
      : await supabase.from('plan_prices').insert(row);
    if (error) return { error: error.message };
  }

  const { error: houseError } = await supabase
    .from('house_settings')
    .update({ free_audio_per_month: d.freeAudioPerMonth, updated_by: viewer.id })
    .eq('id', 1);
  if (houseError) return { error: houseError.message };

  revalidateTag('settings');
  revalidatePath('/membership');
  revalidatePath('/admin/settings/membership');
  return { message: 'Saved. The membership page shows it now.' };
}

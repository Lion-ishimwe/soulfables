'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { field } from '@/lib/form';
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

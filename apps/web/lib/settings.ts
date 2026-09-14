import 'server-only';
import { unstable_cache } from 'next/cache';
import { isDemoMode } from './demo/mode';

/**
 * What the House says about itself.
 *
 * These were typed into the pages that display them, and two files each
 * carried a support address — both on soulfables.com while the site is
 * soulfables.co. That is what a value kept in more than one place does
 * eventually.
 *
 * Cached with the rest of the content layer and busted the moment they
 * are saved, so an editor never sees a stale version of their own edit.
 */
export type Theme = 'dark' | 'light';

export type HouseSettings = {
  siteName: string;
  tagline: string;
  supportEmailGeneral: string;
  supportEmailShop: string;
  siteUrl: string | null;
  /** The palette the whole site wears. Dark unless the House says otherwise. */
  theme: Theme;
  /** The registered business, for receipts and the privacy page. Null until registered. */
  legalName: string | null;
  legalAddress: string | null;
  vatNumber: string | null;
};

/*
 * The defaults are the same as the column defaults in migration 0020,
 * deliberately. Demo mode has no database and an unconfigured install
 * has no row yet; neither should show a reader an empty page where an
 * address belongs.
 */
export const DEFAULT_SETTINGS: HouseSettings = {
  siteName: 'Soulfables',
  tagline: 'Every Soul Has a Story',
  supportEmailGeneral: 'hello@soulfables.co',
  supportEmailShop: 'support@soulfables.co',
  siteUrl: null,
  theme: 'dark',
  legalName: null,
  legalAddress: null,
  vatNumber: null,
};

async function fetchHouseSettings(): Promise<HouseSettings> {
  if (isDemoMode()) return DEFAULT_SETTINGS;

  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();

  const { data } = await supabase
    .from('house_settings')
    .select('site_name, tagline, support_email_general, support_email_shop, site_url, theme, legal_name, legal_address, vat_number')
    .eq('id', 1)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS;

  return {
    siteName: (data.site_name as string) ?? DEFAULT_SETTINGS.siteName,
    tagline: (data.tagline as string) ?? DEFAULT_SETTINGS.tagline,
    supportEmailGeneral:
      (data.support_email_general as string) ?? DEFAULT_SETTINGS.supportEmailGeneral,
    supportEmailShop:
      (data.support_email_shop as string) ?? DEFAULT_SETTINGS.supportEmailShop,
    siteUrl: (data.site_url as string) ?? null,
    theme: data.theme === 'light' ? 'light' : 'dark',
    legalName: (data.legal_name as string) || null,
    legalAddress: (data.legal_address as string) || null,
    vatNumber: (data.vat_number as string) || null,
  };
}

export const getHouseSettings = unstable_cache(fetchHouseSettings, ['house-settings'], {
  revalidate: 300,
  tags: ['content', 'settings'],
});

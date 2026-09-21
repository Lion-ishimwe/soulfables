import Constants from 'expo-constants';

/**
 * Where the app talks to.
 *
 * The site address and the Supabase project are public knowledge; the
 * anon key is too, it only identifies the project and every query is
 * still under row-level security. They are read from app.json's
 * "extra" block, and EXPO_PUBLIC_* environment variables override them
 * so a build can point at a staging site without editing the file.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? extra.siteUrl ?? 'https://soulfables.co';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '';

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'SET_IN_EAS_OR_ENV');

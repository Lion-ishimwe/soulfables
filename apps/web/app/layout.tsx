import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, EB_Garamond, Inter } from 'next/font/google';
import { DemoBanner } from '@/components/demo-banner';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PublicChrome } from '@/components/public-chrome';
import { getHouseSettings } from '@/lib/settings';
import './globals.css';

/*
 * Self-hosted via next/font rather than a Google Fonts <link>. Three
 * reasons: no render-blocking third-party request, no layout shift, and
 * no reader IP going to Google on page load.
 */
const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const reading = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-reading',
  display: 'swap',
});

const ui = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-ui',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://soulfables.co';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Soulfables — Every Soul Has a Story',
    // Every page supplies its own name; the House signs it.
    template: '%s · Soulfables',
  },
  description:
    'A quiet place for modern folktales about love, loss, healing, identity, hope, and becoming.',
  applicationName: 'Soulfables',
  authors: [{ name: 'Apophia Kamwine' }],
  openGraph: {
    type: 'website',
    siteName: 'Soulfables',
    title: 'Soulfables — Every Soul Has a Story',
    description:
      'A quiet place for modern folktales about love, loss, healing, identity, hope, and becoming.',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Soulfables — Every Soul Has a Story',
    description: 'Modern folktales for the heart.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: { canonical: '/' },
};

/*
 * The browser chrome follows the House: the address bar tint and the
 * colour-scheme hint match whichever palette is on. Both come from the
 * same cached settings row the layout reads.
 */
export async function generateViewport(): Promise<Viewport> {
  const { theme } = await getHouseSettings();
  return theme === 'light'
    ? { themeColor: '#F7F3EA', colorScheme: 'light' }
    : { themeColor: '#0B0B0B', colorScheme: 'dark' };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
   * The palette is one attribute on <html>; globals.css does the rest.
   * Reading it here means every page — public, admin, Writing Room —
   * wears the same face, and switching it is one save in Settings.
   */
  const { theme } = await getHouseSettings();

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${display.variable} ${reading.variable} ${ui.variable}`}
    >
      <body className="min-h-screen bg-ink font-ui text-grey antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink-raised focus:px-4 focus:py-2 focus:text-ivory"
        >
          Skip to content
        </a>
        <DemoBanner />
        <PublicChrome>
          <SiteHeader />
        </PublicChrome>
        <main id="main">{children}</main>
        <PublicChrome>
          <SiteFooter />
        </PublicChrome>
      </body>
    </html>
  );
}

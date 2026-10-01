import { Cormorant_Garamond, Nunito_Sans } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import { Suspense, type ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { InstantFeedback } from '@/src/components/sanat/instant-feedback';
import { siteUrl } from '@/src/lib/site-url';
import { SiteFooter } from '@/src/components/site-footer';
import { SiteHeader } from '@/src/components/site-header';
import { PageFrame } from '@/src/components/sanat/page-frame';
import { BRAND_NAME, BRAND_TAGLINE } from '@/src/lib/brand';
import './globals.css';

// Serif for the logo and headings, sans for everything else.
// cyrillic-ext carries the Tajik letters (Ғ Ӣ Қ Ӯ Ҳ Ҷ).
const cormorant = Cormorant_Garamond({
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-cormorant',
  display: 'swap',
});

const nunitoSans = Nunito_Sans({
  weight: ['400', '600', '700'],
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-nunito-sans',
  display: 'swap',
});

// Link previews (Telegram, WhatsApp, social networks): every page gets the
// brand card from app/opengraph-image.jpg unless it sets its own image.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${BRAND_NAME} — место для искусства`, template: `%s — ${BRAND_NAME}` },
  description: BRAND_TAGLINE,
  applicationName: BRAND_NAME,
  openGraph: {
    siteName: BRAND_NAME,
    locale: 'ru_RU',
    type: 'website',
    title: `${BRAND_NAME} — место для искусства`,
    description: BRAND_TAGLINE,
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#617f6c',
  colorScheme: 'light',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${cormorant.variable} ${nunitoSans.variable}`}>
      <body>
        {/* reads the URL's query, so it waits for the client */}
        <Suspense fallback={null}>
          <InstantFeedback />
        </Suspense>
        <div className="stage">
          <SiteHeader />
          <PageFrame>{children}</PageFrame>
          <SiteFooter />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

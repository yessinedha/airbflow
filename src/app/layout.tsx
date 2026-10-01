import type { Metadata, Viewport } from 'next'
import './globals.css'
import { dirOf } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'
import { LocaleProvider } from '@/lib/i18n/client'

export const metadata: Metadata = {
  title: {
    default: 'ArbiFlow — Crypto market analysis',
    template: '%s · ArbiFlow',
  },
  description:
    'An invitation-only platform for crypto market-analysis exercises and configurable internal platform rewards. ArbiFlow does not execute trades or guarantee investment returns. Deposits are real blockchain transfers; withdrawals are settled manually by the operations team.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f1f4ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0b100d' },
  ],
}

/*
 * Typography.
 *
 * Three faces across two scripts: a clean sans for Latin and Arabic
 * counterparts, plus a mono face for figures. Each stack lists the Latin
 * face first and the Arabic face straight after, so the browser resolves
 * per glyph inside the same sentence.
 * No direction-specific font rule is needed.
 *
 * The faces are linked at runtime rather than pulled in by next/font, so a
 * build never depends on reaching Google. If the CDN is blocked the page
 * falls back to the system serif / sans / mono and still reads correctly.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Inter:wght@400;500;600' +
  '&family=JetBrains+Mono:wght@400;500' +
  '&family=IBM+Plex+Sans+Arabic:wght@400;500;600' +
  '&family=Noto+Kufi+Arabic:wght@500;600;700' +
  '&display=swap'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-dvh antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  )
}

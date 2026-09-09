import type { Metadata, Viewport } from 'next'
import './globals.css'
import { dirOf } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'
import { LocaleProvider } from '@/lib/i18n/client'

export const metadata: Metadata = {
  title: {
    default: 'PropVerify — Property verification tasks & rewards',
    template: '%s · PropVerify',
  },
  description:
    'An invitation-only platform where members complete property listing verification tasks and receive internal platform rewards. Deposits are real blockchain transfers; withdrawals are settled manually by the operations team.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2ece1' },
    { media: '(prefers-color-scheme: dark)', color: '#17130f' },
  ],
}

/*
 * Typography.
 *
 * Four faces across two scripts: an editorial serif and a grotesque for
 * Latin, and their Arabic counterparts. Each stack lists the Latin face
 * first and the Arabic face straight after, so the browser resolves per
 * glyph — Latin words keep Fraunces and Inter, Arabic words fall through
 * to Noto Kufi Arabic and IBM Plex Sans Arabic, inside the same sentence.
 * No direction-specific font rule is needed.
 *
 * The faces are linked at runtime rather than pulled in by next/font, so a
 * build never depends on reaching Google. If the CDN is blocked the page
 * falls back to the system serif / sans / mono and still reads correctly.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700' +
  '&family=Inter:wght@400;500;600' +
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

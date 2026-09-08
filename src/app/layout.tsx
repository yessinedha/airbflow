import type { Metadata, Viewport } from 'next'
import './globals.css'

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
 * Three roles, three faces: an editorial serif for headings and hero lines,
 * a neutral grotesque for running text and controls, and a monospace for
 * captions, figures and hashes.
 *
 * The faces are linked at runtime rather than pulled in by next/font, so a
 * build never depends on reaching Google. Each one is only the *first* entry
 * in a stack declared in globals.css — if the CDN is blocked the page falls
 * back to the system serif / sans / mono and still reads correctly.
 *
 * To self-host instead: drop the two <link> tags below, put the .woff2 files
 * in src/app/fonts, switch to next/font/local, and remove the Google hosts
 * from the CSP in next.config.ts.
 */
const FONT_HREF =
  'https://fonts.googleapis.com/css2' +
  '?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700' +
  '&family=Inter:wght@400;500;600' +
  '&family=JetBrains+Mono:wght@400;500' +
  '&display=swap'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_HREF} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // A server action body defaults to 1 MB, which is below the 2 MB the
      // task-image form accepts. Raised so a legitimate photograph is not
      // rejected by the framework before the action can validate it.
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net" +
                (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
              // Google Fonts serves the stylesheet from fonts.googleapis.com
              // and the font files themselves from fonts.gstatic.com. Drop
              // both hosts here if you self-host the faces instead.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Tesseract's worker and core are served from jsDelivr; image data stays client-side.
              // Images only. An operator can point a task illustration at any
              // host, and an <img> cannot execute anything, so https: is
              // allowed here. Narrow this
              // to your Supabase storage origin if you never use outside URLs.
              "img-src 'self' data: blob: https:",
              "worker-src 'self' blob: https://cdn.jsdelivr.net",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tessdata.projectnaptha.com https://cdn.jsdelivr.net",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig

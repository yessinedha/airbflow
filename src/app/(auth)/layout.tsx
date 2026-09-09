import Link from 'next/link'
import { getT } from '@/lib/i18n/server'
import { LocaleSwitcher } from '@/components/locale-switcher'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getT()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-espresso text-sm font-semibold text-espresso-ink">
              P
            </span>
            <span className="display font-semibold tracking-tight">PropVerify</span>
          </Link>
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <Link href="/faq" className="text-sm text-ink-muted hover:text-ink">
              {t.publicSite.howItWorks}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-ink-subtle">
        <Link href="/terms" className="hover:text-ink">
          {t.publicSite.terms}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-ink">
          {t.publicSite.privacy}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/faq" className="hover:text-ink">
          {t.home.ctaFaq}
        </Link>
      </footer>
    </div>
  )
}

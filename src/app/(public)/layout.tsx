import Link from 'next/link'
import { ButtonLink } from '@/components/ui'
import { getT } from '@/lib/i18n/server'
import { LocaleSwitcher } from '@/components/locale-switcher'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getT()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-espresso text-sm font-semibold text-espresso-ink">
              P
            </span>
            <span className="display font-semibold tracking-tight">PropVerify</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-ink-muted sm:flex">
            <Link href="/faq" className="hover:text-ink">
              {t.publicSite.howItWorks}
            </Link>
            <Link href="/terms" className="hover:text-ink">
              {t.publicSite.terms}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {t.publicSite.privacy}
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ButtonLink href="/login" variant="secondary" size="sm">
              {t.publicSite.signIn}
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              {t.publicSite.register}
            </ButtonLink>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-md">
              <p className="display text-lg font-semibold tracking-tight">PropVerify</p>
              <p className="mt-2 text-sm text-ink-muted">{t.publicSite.footerBlurb}</p>
            </div>
            <nav className="flex flex-col gap-2 text-sm text-ink-muted">
              <Link href="/faq" className="hover:text-ink">
                {t.publicSite.howItWorks}
              </Link>
              <Link href="/terms" className="hover:text-ink">
                {t.publicSite.termsOfService}
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                {t.publicSite.privacyPolicy}
              </Link>
            </nav>
          </div>

          <p className="mt-8 border-t border-border pt-6 text-xs leading-relaxed text-ink-subtle">
            {t.publicSite.disclaimer}
          </p>
        </div>
      </footer>
    </div>
  )
}

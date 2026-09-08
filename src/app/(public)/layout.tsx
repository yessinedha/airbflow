import Link from 'next/link'
import { ButtonLink } from '@/components/ui'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
              How it works
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="secondary" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/register" size="sm">
              Register
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
              <p className="mt-2 text-sm text-ink-muted">
                An invitation-only platform for property listing verification tasks. Balances shown in the application
                are internal platform ledger balances.
              </p>
            </div>
            <nav className="flex flex-col gap-2 text-sm text-ink-muted">
              <Link href="/faq" className="hover:text-ink">
                How it works
              </Link>
              <Link href="/terms" className="hover:text-ink">
                Terms of service
              </Link>
              <Link href="/privacy" className="hover:text-ink">
                Privacy policy
              </Link>
            </nav>
          </div>

          <p className="mt-8 border-t border-border pt-6 text-xs leading-relaxed text-ink-subtle">
            PropVerify is not a bank, a broker, a custodian or a licensed financial institution, and it is not
            supervised by a financial regulator. It does not offer investment products and makes no promise of profit or
            return. Task rewards are discretionary platform payments for completed verification work and are set by
            configurable parameters that the operator can change. Digital assets are volatile and transfers on public
            blockchains are irreversible. Only participate with funds you can afford to lose.
          </p>
        </div>
      </footer>
    </div>
  )
}

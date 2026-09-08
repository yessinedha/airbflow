import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          <Link href="/faq" className="text-sm text-ink-muted hover:text-ink">
            How it works
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-ink-subtle">
        <Link href="/terms" className="hover:text-ink">
          Terms
        </Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/faq" className="hover:text-ink">
          FAQ
        </Link>
      </footer>
    </div>
  )
}

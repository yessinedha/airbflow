import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function SiteClosedPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">Temporarily unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">The public site is closed</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          The daily operator check-in was missed. An administrator can restore public access from the operations
          dashboard. No data or infrastructure has been deleted.
        </p>
        <Link href="/admin" className="mt-6 inline-flex text-sm font-medium text-brand hover:underline">
          Administrator sign in
        </Link>
      </section>
    </main>
  )
}

import type { Metadata } from 'next'
import { requireAdminSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-nav'

export const metadata: Metadata = { title: { default: 'Operations', template: '%s · Operations' } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Server-side role gate. Every action and RPC below re-checks it too;
  // this only decides whether the pages render at all.
  const session = await requireAdminSession()
  const supabase = await createSupabaseServerClient()

  const [withdrawals, deposits] = await Promise.all([
    supabase
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .in('status', ['PENDING', 'PROCESSING']),
    supabase.from('deposits').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ])

  return (
    // The operations console is English-only, so it keeps a left-to-right
    // context regardless of the language the member-facing site is set to.
    // Without this, English admin text would render right-aligned whenever
    // a bilingual operator has chosen Arabic.
    <div className="min-h-dvh" dir="ltr">
      <AdminSidebar
        user={{
          username: session.profile.username ?? session.profile.email.split('@')[0]!,
          email: session.profile.email,
          role: session.profile.role,
          pendingWithdrawals: withdrawals.count ?? 0,
          pendingDeposits: deposits.count ?? 0,
        }}
      />

      <main className="lg:ms-60">
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">{children}</div>
      </main>
    </div>
  )
}

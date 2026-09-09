import { requireSession } from '@/lib/auth/session'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { AppBottomNav, AppSidebar } from '@/components/app-nav'
import { formatUsdt } from '@/lib/format'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  const supabase = await createSupabaseServerClient()
  const t = await getT()

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('read', false)

  const vip = session.vipPlan
    ? {
        name: session.vipPlan.name,
        dailyTaskLimit: session.vipPlan.daily_task_limit,
        capital: formatUsdt(session.vipPlan.activation_amount),
      }
    : null

  return (
    <div className="min-h-dvh">
      <AppSidebar
        user={{
          username: session.profile.username ?? session.profile.email.split('@')[0]!,
          email: session.profile.email,
          role: session.profile.role,
          unreadCount: count ?? 0,
          vip,
        }}
      />

      <main className="app-main pb-24 lg:pb-0">
        {/* Status strip — thin dark rule that anchors the workspace. */}
        <div className="hidden items-center gap-2 bg-espresso px-6 py-1.5 text-espresso-muted lg:flex">
          <span aria-hidden className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-espresso-accent" />
          <p className="label-mono">{t.nav.statusStrip}</p>
          <span className="label-mono ms-auto">{t.nav.statusStripRight}</span>
        </div>

        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7">{children}</div>
      </main>

      <AppBottomNav />
    </div>
  )
}

import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  LedgerEntry,
  Notification,
  TeamSummary,
  WithdrawalEligibility,
} from '@/types/database'

/** Start of the current UTC day, matching the SQL `app_today()` boundary. */
export function utcDayStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

export function utcToday(date = new Date()): string {
  return utcDayStart(date).slice(0, 10)
}

/**
 * Wall-clock reading taken on the server, handed to the client so a
 * countdown can be rendered without trusting the device clock. Kept out of
 * component bodies because a render must stay pure.
 */
export function serverClockMs(): number {
  return Date.now()
}

export interface DashboardData {
  todaysRewards: number
  tasksTotal: number
  tasksCompleted: number
  team: TeamSummary | null
  eligibility: WithdrawalEligibility | null
  recentLedger: LedgerEntry[]
  unreadNotifications: Notification[]
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient()
  const dayStart = utcDayStart()
  const today = utcToday()

  const [rewardRows, assignments, teamRes, eligibilityRes, ledgerRes, notificationsRes] = await Promise.all([
    supabase
      .from('ledger_entries')
      .select('amount, type')
      .eq('user_id', userId)
      .in('type', ['TASK_REWARD', 'REFERRAL_REWARD'])
      .gte('created_at', dayStart)
      .returns<{ amount: string; type: string }[]>(),

    supabase
      .from('task_assignments')
      .select('id, status')
      .eq('user_id', userId)
      .eq('assigned_date', today)
      .returns<{ id: string; status: string }[]>(),

    supabase.rpc('get_team_summary', { p_user_id: userId }),
    supabase.rpc('withdrawal_eligibility', { p_user_id: userId }),

    supabase
      .from('ledger_entries')
      .select('*')
      .eq('user_id', userId)
      .order('seq', { ascending: false })
      .limit(6)
      .returns<LedgerEntry[]>(),

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(3)
      .returns<Notification[]>(),
  ])

  const todaysRewards = (rewardRows.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0)
  const rows = assignments.data ?? []

  return {
    todaysRewards,
    tasksTotal: rows.length,
    tasksCompleted: rows.filter((r) => r.status === 'COMPLETED').length,
    team: (teamRes.data as TeamSummary) ?? null,
    eligibility: (eligibilityRes.data as WithdrawalEligibility) ?? null,
    recentLedger: ledgerRes.data ?? [],
    unreadNotifications: notificationsRes.data ?? [],
  }
}

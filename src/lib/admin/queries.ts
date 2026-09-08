import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  AdminAction,
  AdminStats,
  Deposit,
  DepositAddress,
  LedgerEntry,
  LedgerType,
  Notification,
  PlatformSetting,
  Profile,
  Referral,
  SupportedNetwork,
  Task,
  TaskAssignment,
  UserVipPlan,
  VipPlan,
  Withdrawal,
  WithdrawalEligibility,
} from '@/types/database'

/**
 * Read models for /admin.
 *
 * Everything here runs with the *administrator's own* session, so RLS is
 * still the enforcing layer: a non-admin executing these queries would get
 * back only their own rows. The service-role client is deliberately not
 * used for reads.
 *
 * Related profiles are resolved with a second `in (…)` query rather than a
 * PostgREST embed, because several of these tables have two foreign keys
 * to `profiles` and the embed syntax then needs brittle constraint-name
 * hints.
 */

export type ProfileRef = Pick<
  Profile,
  'id' | 'email' | 'username' | 'referral_code' | 'status' | 'role' | 'balance_available'
>

export const PROFILE_REF_COLUMNS = 'id, email, username, referral_code, status, role, balance_available'

export interface Paged<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export const ADMIN_PAGE_SIZE = 25

function paged<T>(rows: T[], total: number, page: number, pageSize: number): Paged<T> {
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

/** Clamps a `?page=` query param into a usable positive integer. */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  const trimmed = v?.trim()
  return trimmed ? trimmed : undefined
}

async function profileMap(ids: (string | null | undefined)[]): Promise<Map<string, ProfileRef>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return new Map()

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('profiles')
    .select(PROFILE_REF_COLUMNS)
    .in('id', unique)
    .returns<ProfileRef[]>()

  return new Map((data ?? []).map((p) => [p.id, p]))
}

/** Escapes user input before it is interpolated into a PostgREST filter. */
function safeFilterValue(value: string): string {
  return value.replace(/[%,()*\\]/g, '').trim()
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export async function loadAdminStats(): Promise<AdminStats | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('admin_dashboard_stats')
  if (error) {
    console.error('[admin] stats failed', error.message)
    return null
  }
  return data as AdminStats
}

export interface AdminOverview {
  stats: AdminStats | null
  pendingWithdrawals: WithdrawalRow[]
  pendingDeposits: DepositRow[]
  recentUsers: ProfileRef[]
  recentActions: AdminActionRow[]
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const supabase = await createSupabaseServerClient()

  const [stats, withdrawals, deposits, users, actions] = await Promise.all([
    loadAdminStats(),
    loadWithdrawals({ status: 'OPEN', pageSize: 5 }),
    loadDeposits({ status: 'PENDING', pageSize: 5 }),
    supabase
      .from('profiles')
      .select(PROFILE_REF_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(5)
      .returns<ProfileRef[]>(),
    loadAuditLogs({ pageSize: 6 }),
  ])

  return {
    stats,
    pendingWithdrawals: withdrawals.rows,
    pendingDeposits: deposits.rows,
    recentUsers: users.data ?? [],
    recentActions: actions.rows,
  }
}

// ---------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------
export async function loadUsers({
  q,
  status,
  role,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  q?: string
  status?: string
  role?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<Profile>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (role) query = query.eq('role', role)

  if (q) {
    const safe = safeFilterValue(q)
    if (safe) {
      query = query.or(`email.ilike.%${safe}%,username.ilike.%${safe}%,referral_code.ilike.%${safe}%`)
    }
  }

  const { data, count } = await query.returns<Profile[]>()
  return paged(data ?? [], count ?? 0, page, pageSize)
}

export interface UserDetail {
  profile: Profile
  vipPlan: VipPlan | null
  referrer: ProfileRef | null
  vipHistory: (UserVipPlan & { planName: string; previousPlanName: string | null })[]
  ledger: LedgerEntry[]
  deposits: Deposit[]
  withdrawals: Withdrawal[]
  assignments: (TaskAssignment & { taskTitle: string })[]
  referralLevels: { level: number; count: number }[]
  directReferrals: ProfileRef[]
  totals: { referralRewards: number; taskRewards: number }
  eligibility: WithdrawalEligibility | null
}

export async function loadUserDetail(userId: string): Promise<UserDetail | null> {
  const supabase = await createSupabaseServerClient()

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle<Profile>()
  if (!profile) return null

  const [plans, history, ledger, deposits, withdrawals, assignments, referrals, tasks, rewardRows, eligibility] =
    await Promise.all([
      supabase.from('vip_plans').select('*').returns<VipPlan[]>(),
      supabase
        .from('user_vip_plans')
        .select('*')
        .eq('user_id', userId)
        .order('activated_at', { ascending: false })
        .returns<UserVipPlan[]>(),
      supabase
        .from('ledger_entries')
        .select('*')
        .eq('user_id', userId)
        .order('seq', { ascending: false })
        .limit(30)
        .returns<LedgerEntry[]>(),
      supabase
        .from('deposits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<Deposit[]>(),
      supabase
        .from('withdrawals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
        .returns<Withdrawal[]>(),
      supabase
        .from('task_assignments')
        .select('*')
        .eq('user_id', userId)
        .order('assigned_date', { ascending: false })
        .limit(30)
        .returns<TaskAssignment[]>(),
      supabase.from('referrals').select('*').eq('referrer_id', userId).returns<Referral[]>(),
      supabase.from('tasks').select('id, title').returns<Pick<Task, 'id' | 'title'>[]>(),
      supabase
        .from('ledger_entries')
        .select('type, amount')
        .eq('user_id', userId)
        .in('type', ['REFERRAL_REWARD', 'TASK_REWARD'])
        .returns<{ type: LedgerType; amount: string }[]>(),
      supabase.rpc('withdrawal_eligibility', { p_user_id: userId }),
    ])

  const planById = new Map((plans.data ?? []).map((p) => [p.id, p]))
  const taskTitleById = new Map((tasks.data ?? []).map((t) => [t.id, t.title]))

  const levelCounts = new Map<number, number>()
  for (const r of referrals.data ?? []) {
    levelCounts.set(r.level, (levelCounts.get(r.level) ?? 0) + 1)
  }

  const directIds = (referrals.data ?? []).filter((r) => r.level === 1).map((r) => r.referred_user_id)
  const [directMap, referrerMap] = await Promise.all([
    profileMap(directIds.slice(0, 50)),
    profileMap([profile.referred_by]),
  ])

  const totals = (rewardRows.data ?? []).reduce(
    (acc, row) => {
      if (row.type === 'REFERRAL_REWARD') acc.referralRewards += Number(row.amount)
      if (row.type === 'TASK_REWARD') acc.taskRewards += Number(row.amount)
      return acc
    },
    { referralRewards: 0, taskRewards: 0 },
  )

  return {
    profile,
    vipPlan: profile.current_vip_plan_id ? (planById.get(profile.current_vip_plan_id) ?? null) : null,
    referrer: profile.referred_by ? (referrerMap.get(profile.referred_by) ?? null) : null,
    vipHistory: (history.data ?? []).map((h) => ({
      ...h,
      planName: planById.get(h.new_plan_id)?.name ?? 'Unknown plan',
      previousPlanName: h.previous_plan_id ? (planById.get(h.previous_plan_id)?.name ?? null) : null,
    })),
    ledger: ledger.data ?? [],
    deposits: deposits.data ?? [],
    withdrawals: withdrawals.data ?? [],
    assignments: (assignments.data ?? []).map((a) => ({
      ...a,
      taskTitle: taskTitleById.get(a.task_id) ?? 'Unknown task',
    })),
    referralLevels: [1, 2, 3].map((level) => ({ level, count: levelCounts.get(level) ?? 0 })),
    directReferrals: directIds.map((id) => directMap.get(id)).filter((p): p is ProfileRef => Boolean(p)),
    totals,
    eligibility: (eligibility.data as WithdrawalEligibility) ?? null,
  }
}

// ---------------------------------------------------------------------
// Deposits
// ---------------------------------------------------------------------
export type DepositRow = Deposit & { user: ProfileRef | null; explorerTemplate: string | null }

export async function loadDeposits({
  status,
  q,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  status?: string
  q?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<DepositRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('deposits')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (q) {
    const safe = safeFilterValue(q)
    if (safe) query = query.or(`tx_hash.ilike.%${safe}%,reference_code.ilike.%${safe}%`)
  }

  const { data, count } = await query.returns<Deposit[]>()
  const rows = data ?? []

  const [users, networks] = await Promise.all([
    profileMap(rows.map((d) => d.user_id)),
    supabase.from('supported_networks').select('code, explorer_tx_url').returns<SupportedNetwork[]>(),
  ])

  const explorerByCode = new Map((networks.data ?? []).map((n) => [n.code, n.explorer_tx_url]))

  return paged(
    rows.map((d) => ({
      ...d,
      user: users.get(d.user_id) ?? null,
      explorerTemplate: explorerByCode.get(d.network_code) ?? null,
    })),
    count ?? 0,
    page,
    pageSize,
  )
}

// ---------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------
export type WithdrawalRow = Withdrawal & {
  user: ProfileRef | null
  processedByUser: ProfileRef | null
  explorerTemplate: string | null
}

export async function loadWithdrawals({
  status,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  /** A concrete status, or `OPEN` for the actionable queue. */
  status?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<WithdrawalRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('withdrawals')
    .select('*', { count: 'exact' })
    .order('requested_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (status === 'OPEN') query = query.in('status', ['PENDING', 'PROCESSING'])
  else if (status) query = query.eq('status', status)

  const { data, count } = await query.returns<Withdrawal[]>()
  const rows = data ?? []

  const [users, networks] = await Promise.all([
    profileMap([...rows.map((w) => w.user_id), ...rows.map((w) => w.processed_by)]),
    supabase.from('supported_networks').select('code, explorer_tx_url').returns<SupportedNetwork[]>(),
  ])

  const explorerByCode = new Map((networks.data ?? []).map((n) => [n.code, n.explorer_tx_url]))

  return paged(
    rows.map((w) => ({
      ...w,
      user: users.get(w.user_id) ?? null,
      processedByUser: w.processed_by ? (users.get(w.processed_by) ?? null) : null,
      explorerTemplate: explorerByCode.get(w.network_code) ?? null,
    })),
    count ?? 0,
    page,
    pageSize,
  )
}

// ---------------------------------------------------------------------
// Task assignments
// ---------------------------------------------------------------------
export type AssignmentRow = TaskAssignment & { user: ProfileRef | null; taskTitle: string }

export async function loadAssignments({
  status,
  date,
  userId,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  status?: string
  date?: string
  userId?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<AssignmentRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('task_assignments')
    .select('*', { count: 'exact' })
    .order('assigned_date', { ascending: false })
    .order('slot', { ascending: true })
    .range(from, from + pageSize - 1)

  if (status) query = query.eq('status', status)
  if (date) query = query.eq('assigned_date', date)
  if (userId) query = query.eq('user_id', userId)

  const { data, count } = await query.returns<TaskAssignment[]>()
  const rows = data ?? []

  const [users, tasks] = await Promise.all([
    profileMap(rows.map((a) => a.user_id)),
    supabase.from('tasks').select('id, title').returns<Pick<Task, 'id' | 'title'>[]>(),
  ])

  const taskTitleById = new Map((tasks.data ?? []).map((t) => [t.id, t.title]))

  return paged(
    rows.map((a) => ({
      ...a,
      user: users.get(a.user_id) ?? null,
      taskTitle: taskTitleById.get(a.task_id) ?? 'Unknown task',
    })),
    count ?? 0,
    page,
    pageSize,
  )
}

// ---------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------
export type LedgerRow = LedgerEntry & { user: ProfileRef | null; createdByUser: ProfileRef | null }

export async function loadGlobalLedger({
  type,
  userId,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  type?: string
  userId?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<LedgerRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('ledger_entries')
    .select('*', { count: 'exact' })
    .order('seq', { ascending: false })
    .range(from, from + pageSize - 1)

  if (type) query = query.eq('type', type)
  if (userId) query = query.eq('user_id', userId)

  const { data, count } = await query.returns<LedgerEntry[]>()
  const rows = data ?? []
  const users = await profileMap([...rows.map((e) => e.user_id), ...rows.map((e) => e.created_by)])

  return paged(
    rows.map((e) => ({
      ...e,
      user: users.get(e.user_id) ?? null,
      createdByUser: e.created_by ? (users.get(e.created_by) ?? null) : null,
    })),
    count ?? 0,
    page,
    pageSize,
  )
}

/** Totals per ledger type, used for the reconciliation panel. */
export async function loadLedgerTotals(): Promise<{ type: LedgerType; total: number; count: number }[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('ledger_entries')
    .select('type, amount')
    .limit(50000)
    .returns<{ type: LedgerType; amount: string }[]>()

  const totals = new Map<LedgerType, { total: number; count: number }>()
  for (const row of data ?? []) {
    const current = totals.get(row.type) ?? { total: 0, count: 0 }
    current.total += Number(row.amount)
    current.count += 1
    totals.set(row.type, current)
  }

  return [...totals.entries()]
    .map(([type, v]) => ({ type, ...v }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
}

// ---------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------
export type ReferralRow = Referral & { referrer: ProfileRef | null; referred: ProfileRef | null }

export async function loadReferrals({
  level,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  level?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<ReferralRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('referrals')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  const parsedLevel = Number(level)
  if (level && Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 3) {
    query = query.eq('level', parsedLevel)
  }

  const { data, count } = await query.returns<Referral[]>()
  const rows = data ?? []
  const users = await profileMap([...rows.map((r) => r.referrer_id), ...rows.map((r) => r.referred_user_id)])

  return paged(
    rows.map((r) => ({
      ...r,
      referrer: users.get(r.referrer_id) ?? null,
      referred: users.get(r.referred_user_id) ?? null,
    })),
    count ?? 0,
    page,
    pageSize,
  )
}

export interface TopReferrer {
  user: ProfileRef | null
  directCount: number
  teamCount: number
  commission: number
}

/**
 * Leaderboard of inviters. Aggregated in the application because the
 * dataset an MVP handles is small; promote to a SQL view if it grows.
 */
export async function loadTopReferrers(limit = 10): Promise<TopReferrer[]> {
  const supabase = await createSupabaseServerClient()

  const [referralsRes, commissionRes] = await Promise.all([
    supabase
      .from('referrals')
      .select('referrer_id, level')
      .limit(20000)
      .returns<Pick<Referral, 'referrer_id' | 'level'>[]>(),
    supabase
      .from('ledger_entries')
      .select('user_id, amount')
      .eq('type', 'REFERRAL_REWARD')
      .limit(20000)
      .returns<{ user_id: string; amount: string }[]>(),
  ])

  const direct = new Map<string, number>()
  const team = new Map<string, number>()
  for (const r of referralsRes.data ?? []) {
    team.set(r.referrer_id, (team.get(r.referrer_id) ?? 0) + 1)
    if (r.level === 1) direct.set(r.referrer_id, (direct.get(r.referrer_id) ?? 0) + 1)
  }

  const commission = new Map<string, number>()
  for (const l of commissionRes.data ?? []) {
    commission.set(l.user_id, (commission.get(l.user_id) ?? 0) + Number(l.amount))
  }

  const ranked = [...team.entries()]
    .sort((a, b) => b[1] - a[1] || (commission.get(b[0]) ?? 0) - (commission.get(a[0]) ?? 0))
    .slice(0, limit)

  const users = await profileMap(ranked.map(([id]) => id))

  return ranked.map(([id, teamCount]) => ({
    user: users.get(id) ?? null,
    directCount: direct.get(id) ?? 0,
    teamCount,
    commission: commission.get(id) ?? 0,
  }))
}

// ---------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------
export type AdminActionRow = AdminAction & { admin: ProfileRef | null }

export async function loadAuditLogs({
  action,
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: {
  action?: string
  page?: number
  pageSize?: number
} = {}): Promise<Paged<AdminActionRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  let query = supabase
    .from('admin_actions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (action) query = query.eq('action', action)

  const { data, count } = await query.returns<AdminAction[]>()
  const rows = data ?? []
  const users = await profileMap(rows.map((a) => a.admin_id))

  return paged(
    rows.map((a) => ({ ...a, admin: a.admin_id ? (users.get(a.admin_id) ?? null) : null })),
    count ?? 0,
    page,
    pageSize,
  )
}

/** Distinct action names, for the audit-log filter dropdown. */
export async function loadAuditActionNames(): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('admin_actions')
    .select('action')
    .order('created_at', { ascending: false })
    .limit(1000)
    .returns<{ action: string }[]>()
  return [...new Set((data ?? []).map((a) => a.action))].sort()
}

// ---------------------------------------------------------------------
// Catalogue tables
// ---------------------------------------------------------------------
export async function loadVipPlans(): Promise<VipPlan[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('vip_plans')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('level', { ascending: true })
    .returns<VipPlan[]>()
  return data ?? []
}

export async function loadTasks(): Promise<Task[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<Task[]>()
  return data ?? []
}

export type NetworkWithAddresses = SupportedNetwork & { addresses: DepositAddress[] }

export async function loadNetworksWithAddresses(): Promise<NetworkWithAddresses[]> {
  const supabase = await createSupabaseServerClient()

  const [networks, addresses] = await Promise.all([
    supabase
      .from('supported_networks')
      .select('*')
      .order('sort_order', { ascending: true })
      .returns<SupportedNetwork[]>(),
    supabase
      .from('deposit_addresses')
      .select('*')
      .order('created_at', { ascending: false })
      .returns<DepositAddress[]>(),
  ])

  return (networks.data ?? []).map((n) => ({
    ...n,
    addresses: (addresses.data ?? []).filter((a) => a.network_id === n.id),
  }))
}

export async function loadSettings(): Promise<PlatformSetting[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('platform_settings')
    .select('*')
    .order('key', { ascending: true })
    .returns<PlatformSetting[]>()
  return data ?? []
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------
export type NotificationRow = Notification & { user: ProfileRef | null }

export async function loadRecentNotifications({
  page = 1,
  pageSize = ADMIN_PAGE_SIZE,
}: { page?: number; pageSize?: number } = {}): Promise<Paged<NotificationRow>> {
  const supabase = await createSupabaseServerClient()
  const from = (page - 1) * pageSize

  const { data, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)
    .returns<Notification[]>()

  const rows = data ?? []
  const users = await profileMap(rows.map((n) => n.user_id))

  return paged(
    rows.map((n) => ({ ...n, user: users.get(n.user_id) ?? null })),
    count ?? 0,
    page,
    pageSize,
  )
}

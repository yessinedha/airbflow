/**
 * Hand-written database types.
 *
 * Keep in sync with supabase/migrations. You can regenerate an equivalent
 * file with:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED'

export type LedgerType =
  | 'DEPOSIT'
  | 'TASK_REWARD'
  | 'REFERRAL_REWARD'
  | 'VIP_ACTIVATION'
  | 'WITHDRAWAL_HOLD'
  | 'WITHDRAWAL_RELEASE'
  | 'WITHDRAWAL_COMPLETED'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND'

export type DepositStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'
export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'CANCELLED'
export type AssignmentStatus = 'AVAILABLE' | 'STARTED' | 'SUBMITTED' | 'COMPLETED' | 'REJECTED' | 'EXPIRED'
export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD'

export interface Profile {
  id: string
  email: string
  username: string | null
  referral_code: string
  referred_by: string | null
  status: UserStatus
  role: UserRole
  balance_available: string
  balance_pending_withdrawal: string
  total_deposited: string
  total_rewards: string
  total_withdrawn: string
  current_vip_plan_id: string | null
  vip_activated_at: string | null
  first_activation_at: string | null
  last_withdrawal_at: string | null
  two_factor_enabled: boolean
  created_at: string
  updated_at: string
}

export interface VipPlan {
  id: string
  name: string
  level: number
  activation_amount: string
  daily_task_limit: number
  reward_rate: string
  referral_enabled: boolean
  active: boolean
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UserVipPlan {
  id: string
  user_id: string
  previous_plan_id: string | null
  new_plan_id: string
  previous_capital: string
  new_capital: string
  amount_charged: string
  activated_at: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  task_type: string
  reward_amount: string | null
  duration_seconds: number
  difficulty: TaskDifficulty
  /** Optional illustration shown on the task card. Decorative only. */
  image_url: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TaskAssignment {
  id: string
  user_id: string
  task_id: string
  assigned_date: string
  slot: number
  status: AssignmentStatus
  started_at: string | null
  completed_at: string | null
  duration_seconds: number
  reward_amount: string
  vip_plan_id: string | null
  submission_data: Record<string, unknown>
  ledger_entry_id: string | null
  created_at: string
}

export interface TaskAssignmentWithTask extends TaskAssignment {
  task: Pick<Task, 'id' | 'title' | 'description' | 'task_type' | 'difficulty' | 'duration_seconds'> | null
}

export interface Referral {
  id: string
  referrer_id: string
  referred_user_id: string
  level: number
  created_at: string
}

export interface SupportedNetwork {
  id: string
  code: string
  name: string
  chain: string
  token_symbol: string
  token_contract: string
  token_decimals: number
  required_confirmations: number
  address_regex: string
  explorer_tx_url: string | null
  min_deposit: string
  min_withdrawal: string
  withdrawal_fee: string
  deposit_enabled: boolean
  withdrawal_enabled: boolean
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DepositAddress {
  id: string
  network_id: string
  address: string
  label: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Deposit {
  id: string
  user_id: string
  amount: string
  verified_amount: string | null
  currency: string
  network_id: string | null
  network_code: string
  token_contract: string | null
  tx_hash: string | null
  payment_proof_path: string | null
  proof_ocr_data: {
    amount: string
    network: string
    status: string
    date: string
    addressMatched: boolean
    rawText: string
  } | null
  from_address: string | null
  to_address: string | null
  confirmations: number
  required_confirmations: number
  status: DepositStatus
  reference_code: string
  verification_payload: Record<string, unknown>
  verification_attempts: number
  last_checked_at: string | null
  rejection_reason: string | null
  ledger_entry_id: string | null
  created_at: string
  confirmed_at: string | null
  credited_at: string | null
  updated_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  amount: string
  fee: string
  net_amount: string
  currency: string
  network_id: string | null
  network_code: string
  destination_address: string
  status: WithdrawalStatus
  tx_hash: string | null
  rejection_reason: string | null
  admin_note: string | null
  processed_by: string | null
  hold_ledger_id: string | null
  requested_at: string
  processed_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface LedgerEntry {
  id: string
  seq: number
  user_id: string
  type: LedgerType
  amount: string
  currency: string
  reference_type: string | null
  reference_id: string | null
  balance_before: string
  balance_after: string
  description: string | null
  created_by: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface AdminAction {
  id: string
  admin_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  payload: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface PlatformSetting {
  key: string
  value: unknown
  description: string | null
  updated_at: string
  updated_by: string | null
}

/** Shape returned by the `withdrawal_eligibility` RPC. */
export interface WithdrawalEligibility {
  eligible: boolean
  reason:
    | null
    | 'NO_ACTIVATION'
    | 'ACCOUNT_NOT_ACTIVE'
    | 'WITHDRAWAL_ALREADY_PENDING'
    | 'COOLDOWN_ACTIVE'
    | 'FIRST_WITHDRAWAL_WAITING_PERIOD'
  is_first_withdrawal: boolean
  anchor_mode: string
  anchor_at: string | null
  eligible_at: string | null
  days_remaining: number | null
  first_withdrawal_wait_days: number
  withdrawal_cooldown_days: number
  available_balance: string
  pending_balance: string
  open_withdrawals: number
}

/** Shape returned by the `get_team_summary` RPC. */
export interface TeamSummary {
  level1: number
  level2: number
  level3: number
  total: number
  active_members: number
  total_commission: string
}

/** Shape returned by the `get_team_members` RPC. */
export interface TeamMember {
  user_id: string
  username: string | null
  masked_email: string
  level: number
  joined_at: string
  vip_plan: string
  is_active: boolean
}

/** Shape returned by the `admin_dashboard_stats` RPC. */
export interface AdminStats {
  total_users: number
  active_users: number
  suspended_users: number
  new_users_today: number
  vip_users: number
  pending_deposits: number
  confirmed_deposits: number
  deposit_volume: string
  pending_withdrawals: number
  pending_withdrawal_amount: string
  completed_withdrawals: number
  withdrawal_volume: string
  tasks_completed_today: number
  rewards_issued_today: string
  referral_rewards_today: string
  referrals_today: number
  total_referrals: number
  total_liability: string
}

export interface ClaimTaskResult {
  assignment_id: string
  reward_amount: number
  balance_after: number
  completed_today: number
  daily_limit: number
}

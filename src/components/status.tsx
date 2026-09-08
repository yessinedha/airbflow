import { Badge, type BadgeTone } from '@/components/ui'
import type {
  AssignmentStatus,
  DepositStatus,
  LedgerType,
  UserStatus,
  WithdrawalStatus,
} from '@/types/database'

const DEPOSIT_TONES: Record<DepositStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'positive',
  REJECTED: 'negative',
}

const WITHDRAWAL_TONES: Record<WithdrawalStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  PAID: 'positive',
  REJECTED: 'negative',
  CANCELLED: 'neutral',
}

const ASSIGNMENT_TONES: Record<AssignmentStatus, BadgeTone> = {
  AVAILABLE: 'neutral',
  STARTED: 'info',
  SUBMITTED: 'info',
  COMPLETED: 'positive',
  REJECTED: 'negative',
  EXPIRED: 'neutral',
}

const USER_TONES: Record<UserStatus, BadgeTone> = {
  ACTIVE: 'positive',
  SUSPENDED: 'warning',
  BANNED: 'negative',
}

export function DepositStatusBadge({ status }: { status: DepositStatus }) {
  return <Badge tone={DEPOSIT_TONES[status]}>{status}</Badge>
}

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  return <Badge tone={WITHDRAWAL_TONES[status]}>{status}</Badge>
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge tone={ASSIGNMENT_TONES[status]}>{status}</Badge>
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={USER_TONES[status]}>{status}</Badge>
}

/** Human labels for ledger movement types. */
export const LEDGER_LABELS: Record<LedgerType, string> = {
  DEPOSIT: 'Deposit',
  TASK_REWARD: 'Task reward',
  REFERRAL_REWARD: 'Referral commission',
  VIP_ACTIVATION: 'VIP activation',
  WITHDRAWAL_HOLD: 'Withdrawal locked',
  WITHDRAWAL_RELEASE: 'Withdrawal released',
  WITHDRAWAL_COMPLETED: 'Withdrawal paid',
  ADMIN_ADJUSTMENT: 'Adjustment',
  REFUND: 'Refund',
}

export function LedgerTypeBadge({ type }: { type: LedgerType }) {
  const tone: BadgeTone =
    type === 'DEPOSIT' || type === 'TASK_REWARD' || type === 'REFERRAL_REWARD' || type === 'REFUND'
      ? 'positive'
      : type === 'WITHDRAWAL_COMPLETED' || type === 'WITHDRAWAL_HOLD' || type === 'VIP_ACTIVATION'
        ? 'negative'
        : 'neutral'

  return <Badge tone={tone}>{LEDGER_LABELS[type]}</Badge>
}

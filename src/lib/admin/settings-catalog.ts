/**
 * Catalogue of the platform's business settings.
 *
 * This file is DATA, not behaviour. It does not change what any rule does —
 * it only tells the admin UI how to render each `platform_settings` row: which
 * control to draw, what unit the number is in, what the allowed values are,
 * and what actually happens when the value changes.
 *
 * The source of truth for every rule remains the SQL function that reads the
 * key at runtime (`get_setting_numeric` / `get_setting_text`). Nothing here is
 * enforced; a key absent from this catalogue is still fully editable through
 * the raw editor, and a key present here can still be set to any value the
 * database accepts.
 *
 * To surface a new knob in the dashboard: read it in SQL with
 * `get_setting_*('my_key', <fallback>)`, then add an entry below.
 */

export type SettingGroupId = 'withdrawals' | 'referrals' | 'vip' | 'tasks' | 'deposits' | 'platform'

export interface SettingGroup {
  id: SettingGroupId
  title: string
  description: string
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: 'withdrawals',
    title: 'Withdrawal rules',
    description:
      'Timing enforced by withdrawal_eligibility() on the server. Countdowns shown to users are cosmetic — only these values decide.',
  },
  {
    id: 'referrals',
    title: 'Referral programme',
    description:
      'Commission paid up the invitation tree. It fires on VIP activation only — never on a deposit, a task reward or a signup.',
  },
  {
    id: 'vip',
    title: 'VIP behaviour',
    description:
      'How activations and upgrades are charged. Amounts and reward rates themselves live on each plan, under VIP plans.',
  },
  { id: 'tasks', title: 'Tasks', description: 'Fallbacks used when a plan or a task does not override them.' },
  { id: 'deposits', title: 'Deposits', description: 'Limits applied when a user opens a deposit request.' },
  { id: 'platform', title: 'Platform identity', description: 'Name and contact details shown to members.' },
]

export type SettingControl =
  | { kind: 'number'; unit?: string; min?: number; max?: number; step?: number; integer?: boolean }
  /** Stored as a fraction (0.08); shown and typed as a percentage (8). */
  | { kind: 'percent'; max?: number }
  | { kind: 'boolean' }
  | { kind: 'enum'; options: { value: string; label: string; help?: string }[] }
  | { kind: 'text' }

export interface SettingSpec {
  key: string
  group: SettingGroupId
  label: string
  /** What the value does, in one sentence. */
  help: string
  /** What changes the moment this value is saved. */
  effect?: string
  control: SettingControl
  /** Value the SQL falls back to when the row is missing entirely. */
  codeDefault: string
  /** SQL function that reads this key, for the operator's reference. */
  readBy: string
}

export const SETTINGS_CATALOG: SettingSpec[] = [
  /* ---------------------------------------------------------------- */
  /* Withdrawals                                                       */
  /* ---------------------------------------------------------------- */
  {
    key: 'first_withdrawal_wait_days',
    group: 'withdrawals',
    label: 'Wait before the first withdrawal',
    help: 'Days a member must wait, counted from the anchor event below, before any withdrawal is allowed.',
    effect: 'Applies immediately to every member who has not yet been paid once. It can move an existing waiting period.',
    control: { kind: 'number', unit: 'days', min: 0, max: 3650, integer: true },
    codeDefault: '30',
    readBy: 'withdrawal_eligibility()',
  },
  {
    key: 'withdrawal_cooldown_days',
    group: 'withdrawals',
    label: 'Cooldown between withdrawals',
    help: 'Days between two withdrawals once the first one has been paid. Counted from the last PAID withdrawal.',
    effect: 'Applies to the next request. A cooldown already running is recalculated against the new value.',
    control: { kind: 'number', unit: 'days', min: 0, max: 3650, integer: true },
    codeDefault: '10',
    readBy: 'withdrawal_eligibility()',
  },
  {
    key: 'first_withdrawal_anchor',
    group: 'withdrawals',
    label: 'What starts the waiting period',
    help: 'The event the first-withdrawal countdown is measured from.',
    control: {
      kind: 'enum',
      options: [
        {
          value: 'VIP_ACTIVATION',
          label: 'First VIP activation',
          help: 'The clock starts when the member activates a plan. A member with no plan can never withdraw.',
        },
        {
          value: 'REGISTRATION',
          label: 'Account creation',
          help: 'The clock starts at signup, so it can elapse before the member has ever deposited.',
        },
      ],
    },
    codeDefault: 'VIP_ACTIVATION',
    readBy: 'withdrawal_eligibility()',
  },

  /* ---------------------------------------------------------------- */
  /* Referrals                                                         */
  /* ---------------------------------------------------------------- */
  {
    key: 'referral_rewards_enabled',
    group: 'referrals',
    label: 'Pay referral commission',
    help: 'Master switch. When off, pay_referral_commission() returns immediately and no level is paid.',
    effect: 'Affects future activations only. Commission already credited stays in the ledger — the ledger is immutable.',
    control: { kind: 'boolean' },
    codeDefault: 'true',
    readBy: 'pay_referral_commission()',
  },
  {
    key: 'referral_level1_percent',
    group: 'referrals',
    label: 'Level 1 — direct inviter',
    help: 'Share of the activation charge paid to the member who invited the buyer.',
    effect: 'Set to 0 to switch this level off without disabling the whole programme.',
    control: { kind: 'percent', max: 100 },
    codeDefault: '0',
    readBy: 'pay_referral_commission()',
  },
  {
    key: 'referral_level2_percent',
    group: 'referrals',
    label: 'Level 2 — inviter of the inviter',
    help: 'Share paid to the second ancestor in the tree.',
    control: { kind: 'percent', max: 100 },
    codeDefault: '0',
    readBy: 'pay_referral_commission()',
  },
  {
    key: 'referral_level3_percent',
    group: 'referrals',
    label: 'Level 3 — third generation',
    help: 'Share paid to the third ancestor. The tree is materialised to three levels only; a fourth is never stored.',
    control: { kind: 'percent', max: 100 },
    codeDefault: '0',
    readBy: 'pay_referral_commission()',
  },

  /* ---------------------------------------------------------------- */
  /* VIP                                                               */
  /* ---------------------------------------------------------------- */
  {
    key: 'vip_upgrade_charge_mode',
    group: 'vip',
    label: 'How an upgrade is charged',
    help: 'What a member pays when moving from one plan to a higher one.',
    effect:
      'Referral commission is computed on the amount actually charged, so this setting also decides how much commission an upgrade generates.',
    control: {
      kind: 'enum',
      options: [
        {
          value: 'FULL',
          label: 'Full price of the new plan',
          help: 'The new plan is billed in full, ignoring what was already paid. Each upgrade pays commission again on the whole amount.',
        },
        {
          value: 'DIFFERENCE',
          label: 'Difference only',
          help: 'The member pays the gap between the two plans. Commission is paid on that gap alone.',
        },
      ],
    },
    codeDefault: 'FULL',
    readBy: 'activate_vip()',
  },
  {
    key: 'vip_allow_downgrade',
    group: 'vip',
    label: 'Allow moving to a lower plan',
    help: 'Whether a member may select a plan below their current level.',
    effect: 'A downgrade never refunds anything. With FULL charging it bills the lower plan in full.',
    control: { kind: 'boolean' },
    codeDefault: 'false',
    readBy: 'activate_vip()',
  },

  /* ---------------------------------------------------------------- */
  /* Tasks                                                             */
  /* ---------------------------------------------------------------- */
  {
    key: 'default_daily_task_limit',
    group: 'tasks',
    label: 'Daily tasks without a plan',
    help: 'How many assignments a member with no active VIP plan receives each day.',
    effect: 'These tasks can be opened and started, but a claim without an active plan is refused by claim_task().',
    control: { kind: 'number', unit: 'tasks / day', min: 0, max: 20, integer: true },
    codeDefault: '3',
    readBy: 'ensure_daily_assignments()',
  },

  /* ---------------------------------------------------------------- */
  /* Deposits                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: 'max_open_deposit_intents',
    group: 'deposits',
    label: 'Open deposit requests per member',
    help: 'How many deposit requests a member may have waiting for a transaction hash at once.',
    effect: 'Guards against a member flooding the deposits table. Does not limit how much they can deposit.',
    control: { kind: 'number', unit: 'requests', min: 1, max: 100, integer: true },
    codeDefault: '5',
    readBy: 'create_deposit_intent()',
  },

  /* ---------------------------------------------------------------- */
  /* Platform                                                          */
  /* ---------------------------------------------------------------- */
  {
    key: 'platform_name',
    group: 'platform',
    label: 'Platform name',
    help: 'Shown in notifications and member-facing copy.',
    control: { kind: 'text' },
    codeDefault: 'PropVerify',
    readBy: 'application code',
  },
  {
    key: 'support_email',
    group: 'platform',
    label: 'Support email',
    help: 'Address members are told to contact.',
    control: { kind: 'text' },
    codeDefault: '',
    readBy: 'application code',
  },
]

export const SETTINGS_BY_KEY = new Map(SETTINGS_CATALOG.map((spec) => [spec.key, spec]))

/** Reads a jsonb value back as the plain string the form should show. */
export function settingToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

export function settingToNumber(value: unknown, fallback = 0): number {
  const n = Number(settingToString(value))
  return Number.isFinite(n) ? n : fallback
}

export function settingToBool(value: unknown): boolean {
  return settingToString(value).toLowerCase() === 'true'
}

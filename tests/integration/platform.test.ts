import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  INTEGRATION_ENABLED,
  SKIP_REASON,
  adminClient,
  cleanupUsers,
  createOperator,
  createUser,
  createUserExpectingFailure,
  creditBalance,
  errorMessage,
  firstVipPlan,
  getProfile,
  isoAgo,
  isoDaysAgo,
  type Db,
  type TestUser,
} from './helpers'

/**
 * End-to-end exercise of the rules that live in SQL.
 *
 * Everything asserted here is a rule a determined user would try to break:
 * registering without an invitation, claiming a reward before the timer has
 * run, claiming a fourth task, withdrawing twice at once, or reading
 * somebody else's ledger. Each is enforced by the database, so the test
 * calls the same RPCs the server actions call, with a real user's JWT.
 */
describe.skipIf(!INTEGRATION_ENABLED)(`platform rules (${INTEGRATION_ENABLED ? 'live' : SKIP_REASON})`, () => {
  let admin: Db
  let operator: TestUser
  let alice: TestUser

  beforeAll(async () => {
    admin = adminClient()
    operator = await createOperator(admin)
    alice = await createUser(admin, 'alice', operator.referralCode)
  }, 120_000)

  afterAll(async () => {
    if (INTEGRATION_ENABLED) await cleanupUsers(admin)
  }, 120_000)

  /* ---------------------------------------------------------------- */
  /* Registration and referrals                                        */
  /* ---------------------------------------------------------------- */
  describe('invitation-only registration', () => {
    it('creates a profile with its own referral code and records the inviter', async () => {
      const profile = await getProfile(admin, alice.id)
      expect(profile.referred_by).toBe(operator.id)
      expect(profile.referral_code).toMatch(/^[A-Z0-9]{6,12}$/)
      expect(profile.referral_code).not.toBe(operator.referralCode)
      expect(profile.status).toBe('ACTIVE')
      expect(profile.role).toBe('USER')
    })

    it('refuses registration with no invitation code', async () => {
      const message = await createUserExpectingFailure(admin, 'nocode')
      expect(message).toMatch(/INVITATION_CODE_REQUIRED/)
    })

    it('refuses registration with an unknown invitation code', async () => {
      const message = await createUserExpectingFailure(admin, 'badcode', 'ZZZZZZ')
      expect(message).toMatch(/INVALID_INVITATION_CODE/)
    })

    it('refuses an invitation from a suspended account', async () => {
      const suspended = await createUser(admin, 'susp', operator.referralCode)
      await admin.from('profiles').update({ status: 'SUSPENDED' }).eq('id', suspended.id)

      const message = await createUserExpectingFailure(admin, 'child', suspended.referralCode)
      expect(message).toMatch(/INVITER_NOT_ACTIVE/)
    })

    it('materialises the ancestor chain three levels deep', async () => {
      const bob = await createUser(admin, 'bob', alice.referralCode)
      const carol = await createUser(admin, 'carol', bob.referralCode)

      const { data } = await admin.from('referrals').select('*').eq('referred_user_id', carol.id)
      const byLevel = new Map((data ?? []).map((r) => [r.level, r.referrer_id]))

      expect(byLevel.get(1)).toBe(bob.id)
      expect(byLevel.get(2)).toBe(alice.id)
      expect(byLevel.get(3)).toBe(operator.id)
    })

    it('never records a user as their own referrer', async () => {
      const { data } = await admin.from('referrals').select('id').eq('referrer_id', alice.id).eq('referred_user_id', alice.id)
      expect(data ?? []).toHaveLength(0)
    })

    it('refuses to change a referrer after registration', async () => {
      const { error } = await admin.from('profiles').update({ referred_by: null }).eq('id', alice.id)
      expect(errorMessage(error)).toMatch(/REFERRER_IMMUTABLE/)
    })

    it('refuses to change a referral code after registration', async () => {
      const { error } = await admin.from('profiles').update({ referral_code: 'HACKED' }).eq('id', alice.id)
      expect(errorMessage(error)).toMatch(/REFERRAL_CODE_IMMUTABLE/)
    })
  })

  /* ---------------------------------------------------------------- */
  /* Ledger integrity                                                  */
  /* ---------------------------------------------------------------- */
  describe('ledger', () => {
    it('refuses a balance change that has no ledger entry', async () => {
      const { error } = await admin.from('profiles').update({ balance_available: 999999 }).eq('id', alice.id)
      expect(errorMessage(error)).toMatch(/BALANCE_CHANGES_REQUIRE_LEDGER_ENTRY/)
    })

    it('writes an entry whose balance_after matches the profile', async () => {
      await creditBalance(operator, alice.id, 500)
      const profile = await getProfile(admin, alice.id)

      const { data: entry } = await admin
        .from('ledger_entries')
        .select('*')
        .eq('user_id', alice.id)
        .order('seq', { ascending: false })
        .limit(1)
        .single()

      expect(entry.type).toBe('ADMIN_ADJUSTMENT')
      expect(Number(entry.amount)).toBe(500)
      expect(Number(entry.balance_after)).toBeCloseTo(Number(profile.balance_available), 8)
    })

    it('refuses to modify a ledger entry', async () => {
      const { data: entry } = await admin
        .from('ledger_entries')
        .select('id')
        .eq('user_id', alice.id)
        .limit(1)
        .single()

      const update = await admin.from('ledger_entries').update({ amount: 1 }).eq('id', entry!.id)
      expect(errorMessage(update.error)).toMatch(/LEDGER_IS_IMMUTABLE/)

      const remove = await admin.from('ledger_entries').delete().eq('id', entry!.id)
      expect(errorMessage(remove.error)).toMatch(/LEDGER_IS_IMMUTABLE/)
    })

    it('refuses to drive a balance below zero', async () => {
      const { error } = await operator.db.rpc('admin_adjust_balance', {
        p_user_id: alice.id,
        p_amount: -10_000_000,
        p_reason: 'Deliberate overdraft attempt',
      })
      expect(errorMessage(error)).toMatch(/INSUFFICIENT_BALANCE/)
    })
  })

  /* ---------------------------------------------------------------- */
  /* VIP                                                               */
  /* ---------------------------------------------------------------- */
  describe('VIP activation', () => {
    it('refuses activation without enough balance', async () => {
      const broke = await createUser(admin, 'broke', operator.referralCode)
      const plan = await firstVipPlan(admin)

      const { error } = await broke.db.rpc('activate_vip', { p_plan_id: plan.id })
      expect(errorMessage(error)).toMatch(/INSUFFICIENT_BALANCE/)
    })

    it('charges the activation amount and records history', async () => {
      const plan = await firstVipPlan(admin)
      const before = await getProfile(admin, alice.id)

      const { error } = await alice.db.rpc('activate_vip', { p_plan_id: plan.id })
      expect(error).toBeNull()

      const after = await getProfile(admin, alice.id)
      expect(after.current_vip_plan_id).toBe(plan.id)
      expect(after.first_activation_at).not.toBeNull()
      expect(Number(after.balance_available)).toBeCloseTo(
        Number(before.balance_available) - Number(plan.activation_amount),
        6,
      )

      const { data: history } = await admin
        .from('user_vip_plans')
        .select('*')
        .eq('user_id', alice.id)
        .order('activated_at', { ascending: false })
        .limit(1)
        .single()
      expect(history.new_plan_id).toBe(plan.id)
      expect(Number(history.amount_charged)).toBeCloseTo(Number(plan.activation_amount), 6)
    })

    it('refuses to activate the plan that is already active', async () => {
      const plan = await firstVipPlan(admin)
      const { error } = await alice.db.rpc('activate_vip', { p_plan_id: plan.id })
      expect(errorMessage(error)).toMatch(/VIP_PLAN_ALREADY_ACTIVE/)
    })

    it('upgrades to a higher level and leaves earlier rewards untouched', async () => {
      const { data: plans } = await admin
        .from('vip_plans')
        .select('*')
        .eq('active', true)
        .order('level', { ascending: true })

      const higher = (plans ?? [])[1]
      if (!higher) return // a single-plan configuration has nothing to upgrade to

      const rewardsBefore = await admin
        .from('ledger_entries')
        .select('id, amount')
        .eq('user_id', alice.id)
        .eq('type', 'TASK_REWARD')

      await creditBalance(operator, alice.id, Number(higher.activation_amount))
      const { error } = await alice.db.rpc('activate_vip', { p_plan_id: higher.id })
      expect(error).toBeNull()

      const profile = await getProfile(admin, alice.id)
      expect(profile.current_vip_plan_id).toBe(higher.id)

      const rewardsAfter = await admin
        .from('ledger_entries')
        .select('id, amount')
        .eq('user_id', alice.id)
        .eq('type', 'TASK_REWARD')

      expect(rewardsAfter.data).toEqual(rewardsBefore.data)
    })

    it('refuses a downgrade while downgrades are disabled', async () => {
      const { data: setting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'vip_allow_downgrade')
        .maybeSingle()
      if (setting?.value === 'true' || setting?.value === true) return

      const lower = await firstVipPlan(admin)
      const profile = await getProfile(admin, alice.id)
      if (profile.current_vip_plan_id === lower.id) return

      const { error } = await alice.db.rpc('activate_vip', { p_plan_id: lower.id })
      expect(errorMessage(error)).toMatch(/VIP_DOWNGRADE_NOT_ALLOWED/)
    })

    it('refuses VIP configuration changes from an ordinary user', async () => {
      const plan = await firstVipPlan(admin)
      const { error } = await alice.db.from('vip_plans').update({ activation_amount: 1 }).eq('id', plan.id)
      expect(error).not.toBeNull()

      const unchanged = await admin.from('vip_plans').select('activation_amount').eq('id', plan.id).single()
      expect(Number(unchanged.data!.activation_amount)).toBe(Number(plan.activation_amount))
    })
  })

  /* ---------------------------------------------------------------- */
  /* Daily tasks                                                       */
  /* ---------------------------------------------------------------- */
  describe('daily tasks', () => {
    let assignmentIds: string[] = []

    it('issues exactly the plan allowance for the current UTC day', async () => {
      const { error } = await alice.db.rpc('ensure_daily_assignments')
      expect(error).toBeNull()

      const profile = await getProfile(admin, alice.id)
      const { data: plan } = await admin
        .from('vip_plans')
        .select('daily_task_limit')
        .eq('id', profile.current_vip_plan_id)
        .single()

      const { data } = await alice.db
        .from('task_assignments')
        .select('id, slot, status')
        .order('slot', { ascending: true })

      const today = (data ?? []).filter((row) => row.status !== 'EXPIRED')
      assignmentIds = today.map((row) => row.id as string)

      expect(assignmentIds.length).toBe(plan!.daily_task_limit)
      expect(new Set(today.map((r) => r.slot)).size).toBe(today.length)
    })

    it('is idempotent: calling it again does not issue more work', async () => {
      await alice.db.rpc('ensure_daily_assignments')
      const { count } = await alice.db.from('task_assignments').select('id', { count: 'exact', head: true })
      expect(count).toBe(assignmentIds.length)
    })

    it('refuses a claim before the timer has elapsed', async () => {
      const id = assignmentIds[0]!
      const started = await alice.db.rpc('start_task', { p_assignment_id: id })
      expect(started.error).toBeNull()

      const claim = await alice.db.rpc('claim_task', { p_assignment_id: id })
      expect(errorMessage(claim.error)).toMatch(/TIMER_NOT_ELAPSED:\d+/)
    })

    it('refuses a claim on a task that was never started', async () => {
      const claim = await alice.db.rpc('claim_task', { p_assignment_id: assignmentIds[1]! })
      expect(errorMessage(claim.error)).toMatch(/TASK_NOT_STARTED/)
    })

    it('pays the reward once the full duration has passed on the server clock', async () => {
      const id = assignmentIds[0]!
      const { data: row } = await admin.from('task_assignments').select('duration_seconds').eq('id', id).single()

      // Move the start time far enough back that the server sees the wait as
      // complete. The countdown in the browser plays no part in this.
      await admin
        .from('task_assignments')
        .update({ started_at: isoAgo(Number(row!.duration_seconds) + 5) })
        .eq('id', id)

      const before = await getProfile(admin, alice.id)
      const claim = await alice.db.rpc('claim_task', { p_assignment_id: id })
      expect(claim.error).toBeNull()

      const reward = Number((claim.data as { reward_amount: number }).reward_amount)
      expect(reward).toBeGreaterThan(0)

      const after = await getProfile(admin, alice.id)
      expect(Number(after.balance_available)).toBeCloseTo(Number(before.balance_available) + reward, 6)

      const { data: entry } = await admin
        .from('ledger_entries')
        .select('*')
        .eq('reference_id', id)
        .eq('type', 'TASK_REWARD')
        .single()
      expect(Number(entry.amount)).toBeCloseTo(reward, 8)
    })

    it('refuses a second claim on the same task', async () => {
      const claim = await alice.db.rpc('claim_task', { p_assignment_id: assignmentIds[0]! })
      expect(errorMessage(claim.error)).toMatch(/TASK_ALREADY_CLAIMED/)
    })

    it('refuses to restart a completed task', async () => {
      const started = await alice.db.rpc('start_task', { p_assignment_id: assignmentIds[0]! })
      expect(started.error).not.toBeNull()
    })

    it('stops at the daily allowance and refuses one more', async () => {
      // Complete everything that is still outstanding for today.
      for (const id of assignmentIds.slice(1)) {
        await alice.db.rpc('start_task', { p_assignment_id: id })
        const { data: row } = await admin.from('task_assignments').select('duration_seconds').eq('id', id).single()
        await admin
          .from('task_assignments')
          .update({ started_at: isoAgo(Number(row!.duration_seconds) + 5) })
          .eq('id', id)
        const claim = await alice.db.rpc('claim_task', { p_assignment_id: id })
        expect(claim.error).toBeNull()
      }

      const profile = await getProfile(admin, alice.id)
      const { data: plan } = await admin
        .from('vip_plans')
        .select('daily_task_limit')
        .eq('id', profile.current_vip_plan_id)
        .single()

      const { count } = await admin
        .from('task_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', alice.id)
        .eq('status', 'COMPLETED')

      expect(count).toBe(plan!.daily_task_limit)

      // A fourth assignment cannot even be created: the unique constraint on
      // (user_id, assigned_date, slot) makes an extra slot impossible, and
      // ensure_daily_assignments issues no more than the allowance.
      await alice.db.rpc('ensure_daily_assignments')
      const { count: total } = await admin
        .from('task_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', alice.id)
      expect(total).toBe(plan!.daily_task_limit)
    })

    it('refuses task work from a suspended account', async () => {
      const suspendedUser = await createUser(admin, 'suspwork', operator.referralCode)
      const plan = await firstVipPlan(admin)
      await creditBalance(operator, suspendedUser.id, Number(plan.activation_amount))
      await suspendedUser.db.rpc('activate_vip', { p_plan_id: plan.id })
      await suspendedUser.db.rpc('ensure_daily_assignments')

      const { data: assignment } = await admin
        .from('task_assignments')
        .select('id, duration_seconds')
        .eq('user_id', suspendedUser.id)
        .limit(1)
        .single()

      await suspendedUser.db.rpc('start_task', { p_assignment_id: assignment!.id })
      await admin
        .from('task_assignments')
        .update({ started_at: isoAgo(Number(assignment!.duration_seconds) + 5) })
        .eq('id', assignment!.id)

      await admin.from('profiles').update({ status: 'SUSPENDED' }).eq('id', suspendedUser.id)

      const claim = await suspendedUser.db.rpc('claim_task', { p_assignment_id: assignment!.id })
      expect(errorMessage(claim.error)).toMatch(/ACCOUNT_NOT_ACTIVE/)
    })

    it('refuses to claim a task belonging to somebody else', async () => {
      const intruder = await createUser(admin, 'intruder', operator.referralCode)
      const claim = await intruder.db.rpc('claim_task', { p_assignment_id: assignmentIds[0]! })
      expect(claim.error).not.toBeNull()
    })

    it('refuses a client-supplied reward: the amount comes from the plan', async () => {
      const { data: assignment } = await admin
        .from('task_assignments')
        .select('id, reward_amount, vip_plan_id, task_id')
        .eq('id', assignmentIds[0]!)
        .single()

      const { data: expected } = await admin.rpc('compute_task_reward', {
        p_plan_id: assignment!.vip_plan_id,
        p_task_id: assignment!.task_id,
      })

      expect(Number(assignment!.reward_amount)).toBeCloseTo(Number(expected), 8)

      const tamper = await alice.db.from('task_assignments').update({ reward_amount: 9999 }).eq('id', assignmentIds[0]!)
      expect(tamper.error).not.toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /* Withdrawals                                                       */
  /* ---------------------------------------------------------------- */
  describe('withdrawals', () => {
    let network: { code: string; min_withdrawal: number; withdrawal_fee: number }
    let address: string

    beforeAll(async () => {
      const { data } = await admin
        .from('supported_networks')
        .select('*')
        .eq('active', true)
        .eq('withdrawal_enabled', true)
        .order('sort_order', { ascending: true })
        .limit(1)
        .single()

      network = data as typeof network
      // An address that satisfies the network's own format rule.
      address =
        network.code === 'TRC20'
          ? 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR'
          : `0x${'1'.repeat(40)}`
    })

    it('refuses the first withdrawal during the waiting period', async () => {
      await creditBalance(operator, alice.id, 500)

      const eligibility = await alice.db.rpc('withdrawal_eligibility', { p_user_id: alice.id })
      expect((eligibility.data as { eligible: boolean }).eligible).toBe(false)
      expect((eligibility.data as { reason: string }).reason).toBe('FIRST_WITHDRAWAL_WAITING_PERIOD')

      const { error } = await alice.db.rpc('request_withdrawal', {
        p_amount: 80,
        p_network_code: network.code,
        p_address: address,
      })
      expect(errorMessage(error)).toMatch(/NOT_ELIGIBLE:FIRST_WITHDRAWAL_WAITING_PERIOD/)
    })

    it('locks the funds once the waiting period has passed', async () => {
      const { data: waitSetting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'first_withdrawal_wait_days')
        .single()
      const waitDays = Number(waitSetting!.value)

      // Backdate the activation so the 30-day rule is satisfied.
      await admin
        .from('profiles')
        .update({ first_activation_at: isoDaysAgo(waitDays + 1) })
        .eq('id', alice.id)

      const before = await getProfile(admin, alice.id)
      const amount = Math.max(Number(network.min_withdrawal), 20)

      const { data, error } = await alice.db.rpc('request_withdrawal', {
        p_amount: amount,
        p_network_code: network.code,
        p_address: address,
      })
      expect(error).toBeNull()

      const after = await getProfile(admin, alice.id)
      expect(Number(after.balance_available)).toBeCloseTo(Number(before.balance_available) - amount, 6)
      expect(Number(after.balance_pending_withdrawal)).toBeCloseTo(
        Number(before.balance_pending_withdrawal) + amount,
        6,
      )

      const withdrawalId = (data as { withdrawal_id: string }).withdrawal_id
      const { data: hold } = await admin
        .from('ledger_entries')
        .select('*')
        .eq('reference_id', withdrawalId)
        .eq('type', 'WITHDRAWAL_HOLD')
        .single()
      expect(Number(hold.amount)).toBeCloseTo(-amount, 8)
    })

    it('refuses a second request while one is open', async () => {
      const { error } = await alice.db.rpc('request_withdrawal', {
        p_amount: Math.max(Number(network.min_withdrawal), 20),
        p_network_code: network.code,
        p_address: address,
      })
      expect(errorMessage(error)).toMatch(/NOT_ELIGIBLE:WITHDRAWAL_ALREADY_PENDING|uq_withdrawal_one_open_per_user/)
    })

    it('releases the locked funds when an operator rejects the request', async () => {
      const { data: open } = await admin
        .from('withdrawals')
        .select('*')
        .eq('user_id', alice.id)
        .in('status', ['PENDING', 'PROCESSING'])
        .single()

      const before = await getProfile(admin, alice.id)

      const { error } = await operator.db.rpc('admin_reject_withdrawal', {
        p_withdrawal_id: open!.id,
        p_reason: 'Integration test rejection',
      })
      expect(error).toBeNull()

      const after = await getProfile(admin, alice.id)
      expect(Number(after.balance_available)).toBeCloseTo(
        Number(before.balance_available) + Number(open!.amount),
        6,
      )
      expect(Number(after.balance_pending_withdrawal)).toBeCloseTo(
        Number(before.balance_pending_withdrawal) - Number(open!.amount),
        6,
      )

      const { data: released } = await admin
        .from('ledger_entries')
        .select('*')
        .eq('reference_id', open!.id)
        .eq('type', 'WITHDRAWAL_RELEASE')
        .single()
      expect(Number(released.amount)).toBeCloseTo(Number(open!.amount), 8)
    })

    it('refuses an address that does not match the network format', async () => {
      const { error } = await alice.db.rpc('request_withdrawal', {
        p_amount: Math.max(Number(network.min_withdrawal), 20),
        p_network_code: network.code,
        p_address: 'clearly-not-a-wallet',
      })
      expect(errorMessage(error)).toMatch(/INVALID_DESTINATION_ADDRESS/)
    })

    it('refuses an amount below the network minimum', async () => {
      const tiny = Number(network.min_withdrawal) / 2
      if (tiny <= 0) return

      const { error } = await alice.db.rpc('request_withdrawal', {
        p_amount: tiny,
        p_network_code: network.code,
        p_address: address,
      })
      expect(errorMessage(error)).toMatch(/AMOUNT_BELOW_MINIMUM|AMOUNT_DOES_NOT_COVER_FEE/)
    })

    it('refuses more than the available balance', async () => {
      const { error } = await alice.db.rpc('request_withdrawal', {
        p_amount: 10_000_000,
        p_network_code: network.code,
        p_address: address,
      })
      expect(errorMessage(error)).toMatch(/INSUFFICIENT_BALANCE/)
    })

    it('settles a payment, records the hash and starts the cooldown', async () => {
      const amount = Math.max(Number(network.min_withdrawal), 20)
      const requested = await alice.db.rpc('request_withdrawal', {
        p_amount: amount,
        p_network_code: network.code,
        p_address: address,
      })
      expect(requested.error).toBeNull()

      const withdrawalId = (requested.data as { withdrawal_id: string }).withdrawal_id
      const txHash = `0x${'e'.repeat(64)}`

      const processing = await operator.db.rpc('admin_start_withdrawal_processing', { p_withdrawal_id: withdrawalId })
      expect(processing.error).toBeNull()

      const before = await getProfile(admin, alice.id)
      const paid = await operator.db.rpc('admin_mark_withdrawal_paid', {
        p_withdrawal_id: withdrawalId,
        p_tx_hash: txHash,
        p_note: 'Integration test settlement',
      })
      expect(paid.error).toBeNull()

      const { data: row } = await admin.from('withdrawals').select('*').eq('id', withdrawalId).single()
      expect(row.status).toBe('PAID')
      expect(row.tx_hash).toBe(txHash)
      expect(row.paid_at).not.toBeNull()
      expect(row.processed_by).toBe(operator.id)

      const after = await getProfile(admin, alice.id)
      expect(Number(after.balance_pending_withdrawal)).toBeCloseTo(
        Number(before.balance_pending_withdrawal) - Number(row.amount),
        6,
      )
      expect(Number(after.total_withdrawn)).toBeCloseTo(Number(before.total_withdrawn) + Number(row.amount), 6)

      const { data: completed } = await admin
        .from('ledger_entries')
        .select('*')
        .eq('reference_id', withdrawalId)
        .eq('type', 'WITHDRAWAL_COMPLETED')
        .single()
      expect(Number(completed.amount)).toBeCloseTo(-Number(row.amount), 8)

      // The cooldown now applies rather than the first-withdrawal wait.
      const eligibility = await alice.db.rpc('withdrawal_eligibility', { p_user_id: alice.id })
      const state = eligibility.data as { eligible: boolean; reason: string; is_first_withdrawal: boolean }
      expect(state.is_first_withdrawal).toBe(false)
      expect(state.eligible).toBe(false)
      expect(state.reason).toBe('COOLDOWN_ACTIVE')
    })

    it('allows the next withdrawal once the cooldown has elapsed', async () => {
      const { data: cooldownSetting } = await admin
        .from('platform_settings')
        .select('value')
        .eq('key', 'withdrawal_cooldown_days')
        .single()
      const cooldownDays = Number(cooldownSetting!.value)

      await admin
        .from('profiles')
        .update({ last_withdrawal_at: isoDaysAgo(cooldownDays + 1) })
        .eq('id', alice.id)

      const eligibility = await alice.db.rpc('withdrawal_eligibility', { p_user_id: alice.id })
      expect((eligibility.data as { eligible: boolean }).eligible).toBe(true)

      const requested = await alice.db.rpc('request_withdrawal', {
        p_amount: Math.max(Number(network.min_withdrawal), 20),
        p_network_code: network.code,
        p_address: address,
      })
      expect(requested.error).toBeNull()

      // Leave the account clean for any later test.
      await alice.db.rpc('cancel_withdrawal', {
        p_withdrawal_id: (requested.data as { withdrawal_id: string }).withdrawal_id,
      })
    })

    it('refuses an operator action on a withdrawal in the wrong state', async () => {
      const { data: paid } = await admin
        .from('withdrawals')
        .select('id')
        .eq('user_id', alice.id)
        .eq('status', 'PAID')
        .limit(1)
        .single()

      const { error } = await operator.db.rpc('admin_mark_withdrawal_paid', {
        p_withdrawal_id: paid!.id,
        p_tx_hash: `0x${'f'.repeat(64)}`,
        p_note: null,
      })
      expect(errorMessage(error)).toMatch(/INVALID_WITHDRAWAL_STATE/)
    })
  })

  /* ---------------------------------------------------------------- */
  /* Deposits                                                          */
  /* ---------------------------------------------------------------- */
  describe('deposits', () => {
    it('never credits an intent on its own', async () => {
      const { data: net } = await admin
        .from('supported_networks')
        .select('code, id')
        .eq('active', true)
        .eq('deposit_enabled', true)
        .limit(1)
        .single()

      const { count } = await admin
        .from('deposit_addresses')
        .select('id', { count: 'exact', head: true })
        .eq('network_id', net!.id)
        .eq('active', true)

      const before = await getProfile(admin, alice.id)
      const { data, error } = await alice.db.rpc('create_deposit_intent', {
        p_amount: 125,
        p_network_code: net!.code,
      })

      if ((count ?? 0) === 0) {
        // Without a configured wallet the platform refuses to give out
        // instructions at all, rather than showing an address that is wrong.
        expect(errorMessage(error)).toMatch(/NO_DEPOSIT_ADDRESS_CONFIGURED/)
        return
      }

      expect(error).toBeNull()
      expect((data as { status: string }).status).toBe('PENDING')

      const after = await getProfile(admin, alice.id)
      expect(Number(after.balance_available)).toBeCloseTo(Number(before.balance_available), 8)
    })

    it('refuses to record the same transaction hash twice', async () => {
      const { data: net } = await admin
        .from('supported_networks')
        .select('code')
        .eq('active', true)
        .limit(1)
        .single()

      const hash = `0x${'d'.repeat(64)}`
      const rows = [1, 2].map(() => ({
        user_id: alice.id,
        amount: 125,
        network_code: net!.code,
        tx_hash: hash,
        reference_code: `TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      }))

      const first = await admin.from('deposits').insert(rows[0]!)
      expect(first.error).toBeNull()

      const second = await admin.from('deposits').insert(rows[1]!)
      expect(errorMessage(second.error)).toMatch(/uq_deposit_network_txhash|duplicate key/)

      await admin.from('deposits').delete().eq('tx_hash', hash)
    })

    it('refuses a deposit row written directly by a user', async () => {
      const { error } = await alice.db.from('deposits').insert({
        user_id: alice.id,
        amount: 1000,
        network_code: 'TRC20',
        reference_code: 'FAKE',
        status: 'CONFIRMED',
      })
      expect(error).not.toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /* Row level security                                                */
  /* ---------------------------------------------------------------- */
  describe('row level security', () => {
    let mallory: TestUser

    beforeAll(async () => {
      mallory = await createUser(admin, 'mallory', operator.referralCode)
    })

    it('hides another user’s profile', async () => {
      const { data } = await mallory.db.from('profiles').select('*').eq('id', alice.id)
      expect(data ?? []).toHaveLength(0)
    })

    it('hides another user’s ledger', async () => {
      const { data } = await mallory.db.from('ledger_entries').select('*').eq('user_id', alice.id)
      expect(data ?? []).toHaveLength(0)
    })

    it('hides another user’s deposits, withdrawals and tasks', async () => {
      for (const table of ['deposits', 'withdrawals', 'task_assignments']) {
        const { data } = await mallory.db.from(table).select('*').eq('user_id', alice.id)
        expect(data ?? []).toHaveLength(0)
      }
    })

    it('hides another user’s notifications', async () => {
      const { data } = await mallory.db.from('notifications').select('*').eq('user_id', alice.id)
      expect(data ?? []).toHaveLength(0)
    })

    it('hides the audit log from ordinary users', async () => {
      const { data } = await mallory.db.from('admin_actions').select('*')
      expect(data ?? []).toHaveLength(0)
    })

    it('refuses admin RPCs called by an ordinary user', async () => {
      const stats = await mallory.db.rpc('admin_dashboard_stats')
      expect(stats.error).not.toBeNull()

      const adjust = await mallory.db.rpc('admin_adjust_balance', {
        p_user_id: mallory.id,
        p_amount: 1000,
        p_reason: 'Self service enrichment',
      })
      expect(adjust.error).not.toBeNull()

      const profile = await getProfile(admin, mallory.id)
      expect(Number(profile.balance_available)).toBe(0)
    })

    it('refuses a self-promotion to administrator', async () => {
      const { error } = await mallory.db.from('profiles').update({ role: 'ADMIN' }).eq('id', mallory.id)
      expect(errorMessage(error)).toMatch(/ROLE_OR_STATUS_CHANGE_NOT_AUTHORIZED/)

      const profile = await getProfile(admin, mallory.id)
      expect(profile.role).toBe('USER')
    })

    it('refuses direct execution of the ledger primitive', async () => {
      const { error } = await mallory.db.rpc('app_post_ledger', {
        p_user_id: mallory.id,
        p_type: 'DEPOSIT',
        p_amount: 1000,
      })
      expect(error).not.toBeNull()
    })

    it('shows a user their own team but masks team members’ emails', async () => {
      const { data, error } = await alice.db.rpc('get_team_members', { p_user_id: alice.id })
      expect(error).toBeNull()
      for (const member of (data ?? []) as { masked_email: string }[]) {
        expect(member.masked_email).toMatch(/\*\*\*@/)
      }
    })

    it('refuses to read another user’s team', async () => {
      const { error } = await mallory.db.rpc('get_team_summary', { p_user_id: alice.id })
      expect(error).not.toBeNull()
    })

    it('lets a user mark only their own notification as read', async () => {
      const { data: own } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', alice.id)
        .limit(1)
        .maybeSingle()

      if (own) {
        const mine = await alice.db.from('notifications').update({ read: true }).eq('id', own.id).select('id')
        expect(mine.error).toBeNull()

        const theirs = await mallory.db.from('notifications').update({ read: true }).eq('id', own.id).select('id')
        expect(theirs.data ?? []).toHaveLength(0)
      }
    })
  })

  /* ---------------------------------------------------------------- */
  /* Audit trail                                                       */
  /* ---------------------------------------------------------------- */
  describe('audit trail', () => {
    it('records every privileged action with the operator who made it', async () => {
      const { data } = await operator.db
        .from('admin_actions')
        .select('*')
        .eq('admin_id', operator.id)
        .order('created_at', { ascending: false })
        .limit(20)

      const actions = (data ?? []).map((row) => row.action as string)
      expect(actions.length).toBeGreaterThan(0)
      expect(actions).toEqual(expect.arrayContaining(['withdrawal.paid']))
    })
  })
})

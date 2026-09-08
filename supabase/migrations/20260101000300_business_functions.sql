-- =====================================================================
-- 20260101000300_business_functions.sql
-- All balance-affecting business logic lives here so it executes
-- atomically, under row locks, with server-side time and server-side
-- reward calculation. The client never supplies an amount that is used.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Server-side "today" for the daily task cycle (UTC).
create or replace function app_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'utc')::date;
$$;

-- Reward for one task under one VIP plan. Always evaluated server side.
create or replace function compute_task_reward(p_plan_id uuid, p_task_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan  vip_plans%rowtype;
  v_task  tasks%rowtype;
begin
  select * into v_task from tasks where id = p_task_id;
  if not found then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A task with an explicit reward always wins over the VIP derived value.
  if v_task.reward_amount is not null then
    return round(v_task.reward_amount, 2);
  end if;

  select * into v_plan from vip_plans where id = p_plan_id;
  if not found then
    return 0;
  end if;

  if v_plan.daily_task_limit <= 0 then
    return 0;
  end if;

  -- Configurable task reward budget, split evenly across the day's tasks.
  return round((v_plan.activation_amount * v_plan.reward_rate) / v_plan.daily_task_limit, 2);
end;
$$;

-- ---------------------------------------------------------------------
-- Daily task assignment
-- ---------------------------------------------------------------------
create or replace function ensure_daily_assignments()
returns setof task_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   profiles%rowtype;
  v_date      date := app_today();
  v_limit     integer;
  v_existing  integer;
  v_slot      integer;
  v_task      tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = v_uid;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_profile.status <> 'ACTIVE' then
    return query select * from task_assignments
      where user_id = v_uid and assigned_date = v_date
      order by slot;
    return;
  end if;

  select coalesce(
           (select daily_task_limit from vip_plans where id = v_profile.current_vip_plan_id and active),
           get_setting_numeric('default_daily_task_limit', 3)::int
         )
    into v_limit;

  select count(*) into v_existing
  from task_assignments
  where user_id = v_uid and assigned_date = v_date;

  if v_existing < v_limit then
    v_slot := v_existing;
    for v_task in
      select t.*
      from tasks t
      where t.active
        and not exists (
          select 1 from task_assignments a
          where a.user_id = v_uid and a.assigned_date = v_date and a.task_id = t.id
        )
      order by md5(v_uid::text || v_date::text || t.id::text)
      limit (v_limit - v_existing)
    loop
      v_slot := v_slot + 1;
      insert into task_assignments (
        user_id, task_id, assigned_date, slot, status, duration_seconds, vip_plan_id
      )
      values (
        v_uid, v_task.id, v_date, v_slot, 'AVAILABLE', v_task.duration_seconds, v_profile.current_vip_plan_id
      )
      on conflict do nothing;
    end loop;
  end if;

  return query
    select * from task_assignments
    where user_id = v_uid and assigned_date = v_date
    order by slot;
end;
$$;

-- ---------------------------------------------------------------------
-- start_task : stamps the authoritative server-side start time
-- ---------------------------------------------------------------------
create or replace function start_task(p_assignment_id uuid)
returns task_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_profile    profiles%rowtype;
  v_assignment task_assignments%rowtype;
  v_task       tasks%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = v_uid;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_assignment from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'ASSIGNMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_assignment.user_id <> v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_assignment.assigned_date <> app_today() then
    raise exception 'ASSIGNMENT_EXPIRED' using errcode = 'P0001';
  end if;
  if v_assignment.status = 'COMPLETED' then
    raise exception 'TASK_ALREADY_COMPLETED' using errcode = 'P0001';
  end if;
  if v_assignment.status <> 'AVAILABLE' then
    raise exception 'TASK_ALREADY_STARTED' using errcode = 'P0001';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;
  if not found or not v_task.active then
    raise exception 'TASK_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  update task_assignments
  set status           = 'STARTED',
      started_at       = now(),
      duration_seconds = v_task.duration_seconds,
      vip_plan_id      = v_profile.current_vip_plan_id
  where id = p_assignment_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

-- ---------------------------------------------------------------------
-- claim_task : the full validation gate described in the spec
-- ---------------------------------------------------------------------
create or replace function claim_task(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_profile     profiles%rowtype;
  v_assignment  task_assignments%rowtype;
  v_task        tasks%rowtype;
  v_plan        vip_plans%rowtype;
  v_date        date := app_today();
  v_completed   integer;
  v_reward      numeric(20, 8);
  v_entry       ledger_entries%rowtype;
  v_elapsed     numeric;
begin
  -- 1. authenticated user
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = v_uid;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 7. user is active
  if v_profile.status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  -- 8. VIP is active
  if v_profile.current_vip_plan_id is null then
    raise exception 'NO_ACTIVE_VIP_PLAN' using errcode = 'P0001';
  end if;

  select * into v_plan from vip_plans where id = v_profile.current_vip_plan_id;
  if not found or not v_plan.active then
    raise exception 'VIP_PLAN_INACTIVE' using errcode = 'P0001';
  end if;

  -- Lock the assignment: concurrent double-claims serialise here.
  select * into v_assignment from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'ASSIGNMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- 2. task belongs to the caller
  if v_assignment.user_id <> v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  -- 5. not already claimed
  if v_assignment.status = 'COMPLETED' then
    raise exception 'TASK_ALREADY_CLAIMED' using errcode = 'P0001';
  end if;

  -- 3. assignment must be in STARTED state
  if v_assignment.status <> 'STARTED' or v_assignment.started_at is null then
    raise exception 'TASK_NOT_STARTED' using errcode = 'P0001';
  end if;

  -- 9. still eligible for today's cycle
  if v_assignment.assigned_date <> v_date then
    raise exception 'ASSIGNMENT_EXPIRED' using errcode = 'P0001';
  end if;

  -- 4. server time >= started_at + duration. The browser timer is decorative.
  v_elapsed := extract(epoch from (now() - v_assignment.started_at));
  if v_elapsed < v_assignment.duration_seconds then
    raise exception 'TIMER_NOT_ELAPSED:%', ceil(v_assignment.duration_seconds - v_elapsed)::int
      using errcode = 'P0001';
  end if;

  -- 6. daily limit not exceeded
  select count(*) into v_completed
  from task_assignments
  where user_id = v_uid and assigned_date = v_date and status = 'COMPLETED';

  if v_completed >= v_plan.daily_task_limit then
    raise exception 'DAILY_TASK_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;
  if not found or not v_task.active then
    raise exception 'TASK_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  -- Reward is derived server side from the CURRENT active plan.
  v_reward := compute_task_reward(v_profile.current_vip_plan_id, v_assignment.task_id);
  if v_reward <= 0 then
    raise exception 'REWARD_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  v_entry := app_post_ledger(
    v_uid,
    'TASK_REWARD',
    v_reward,
    'task_assignment',
    v_assignment.id,
    format('Task reward: %s', v_task.title),
    v_uid
  );

  update task_assignments
  set status          = 'COMPLETED',
      completed_at    = now(),
      reward_amount   = v_reward,
      vip_plan_id     = v_profile.current_vip_plan_id,
      ledger_entry_id = v_entry.id
  where id = p_assignment_id
  returning * into v_assignment;

  perform app_notify(
    v_uid,
    'Task completed',
    format('You received %s USDT for "%s".', to_char(v_reward, 'FM999999990.00'), v_task.title),
    'SUCCESS',
    jsonb_build_object('event', 'task_reward', 'assignment_id', v_assignment.id, 'amount', v_reward)
  );

  return jsonb_build_object(
    'assignment_id',   v_assignment.id,
    'reward_amount',   v_reward,
    'balance_after',   v_entry.balance_after,
    'completed_today', v_completed + 1,
    'daily_limit',     v_plan.daily_task_limit
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Referral commission, paid out of real platform revenue (the VIP
-- activation fee the platform actually collected). This is a revenue
-- share, not a redistribution of other users' deposits.
-- ---------------------------------------------------------------------
create or replace function pay_referral_commission(
  p_user_id        uuid,
  p_source_amount  numeric,
  p_reference_type text,
  p_reference_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec      record;
  v_percent  numeric;
  v_amount   numeric(20, 8);
  v_enabled  boolean := get_setting_text('referral_rewards_enabled', 'true') = 'true';
begin
  if not v_enabled or p_source_amount is null or p_source_amount <= 0 then
    return;
  end if;

  for v_rec in
    select r.referrer_id, r.level, p.status
    from referrals r
    join profiles p on p.id = r.referrer_id
    where r.referred_user_id = p_user_id
    order by r.level
  loop
    continue when v_rec.status <> 'ACTIVE';

    v_percent := get_setting_numeric('referral_level' || v_rec.level || '_percent', 0);
    if v_percent <= 0 then
      continue;
    end if;

    v_amount := round(p_source_amount * v_percent, 2);
    if v_amount <= 0 then
      continue;
    end if;

    perform app_post_ledger(
      v_rec.referrer_id,
      'REFERRAL_REWARD',
      v_amount,
      p_reference_type,
      p_reference_id,
      format('Level %s referral commission', v_rec.level),
      p_user_id
    );

    perform app_notify(
      v_rec.referrer_id,
      'Referral commission received',
      format('You earned %s USDT from a level %s team member activation.',
             to_char(v_amount, 'FM999999990.00'), v_rec.level),
      'SUCCESS',
      jsonb_build_object('event', 'referral_reward', 'level', v_rec.level, 'amount', v_amount)
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- VIP activation / upgrade
-- ---------------------------------------------------------------------
create or replace function activate_vip(p_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid            uuid := auth.uid();
  v_profile        profiles%rowtype;
  v_plan           vip_plans%rowtype;
  v_current        vip_plans%rowtype;
  v_charge         numeric(20, 8);
  v_mode           text := get_setting_text('vip_upgrade_charge_mode', 'FULL');
  v_allow_downgrade boolean := get_setting_text('vip_allow_downgrade', 'false') = 'true';
  v_entry          ledger_entries%rowtype;
  v_history_id     uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = v_uid for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_plan from vip_plans where id = p_plan_id;
  if not found then
    raise exception 'VIP_PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_plan.active then
    raise exception 'VIP_PLAN_INACTIVE' using errcode = 'P0001';
  end if;

  if v_profile.current_vip_plan_id is not null then
    select * into v_current from vip_plans where id = v_profile.current_vip_plan_id;

    if v_current.id = v_plan.id then
      raise exception 'VIP_PLAN_ALREADY_ACTIVE' using errcode = 'P0001';
    end if;

    if v_plan.level < v_current.level and not v_allow_downgrade then
      raise exception 'VIP_DOWNGRADE_NOT_ALLOWED' using errcode = 'P0001';
    end if;
  end if;

  if v_mode = 'DIFFERENCE' and v_current.id is not null then
    v_charge := greatest(v_plan.activation_amount - v_current.activation_amount, 0);
  else
    v_charge := v_plan.activation_amount;
  end if;

  if v_charge > 0 then
    if v_profile.balance_available < v_charge then
      raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
    end if;

    v_entry := app_post_ledger(
      v_uid,
      'VIP_ACTIVATION',
      -v_charge,
      'vip_plan',
      v_plan.id,
      format('%s activation', v_plan.name),
      v_uid
    );
  end if;

  insert into user_vip_plans (
    user_id, previous_plan_id, new_plan_id, previous_capital, new_capital, amount_charged
  )
  values (
    v_uid,
    v_profile.current_vip_plan_id,
    v_plan.id,
    coalesce(v_current.activation_amount, 0),
    v_plan.activation_amount,
    v_charge
  )
  returning id into v_history_id;

  update profiles
  set current_vip_plan_id  = v_plan.id,
      vip_activated_at     = now(),
      first_activation_at  = coalesce(first_activation_at, now()),
      updated_at           = now()
  where id = v_uid;

  perform pay_referral_commission(v_uid, v_charge, 'vip_activation', v_history_id);

  perform app_notify(
    v_uid,
    format('%s activated', v_plan.name),
    format('%s is now your active plan. Your daily task allowance is %s tasks.',
           v_plan.name, v_plan.daily_task_limit),
    'SUCCESS',
    jsonb_build_object('event', 'vip_activated', 'plan_id', v_plan.id)
  );

  return jsonb_build_object(
    'plan_id',          v_plan.id,
    'plan_name',        v_plan.name,
    'amount_charged',   v_charge,
    'daily_task_limit', v_plan.daily_task_limit
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Deposits
-- ---------------------------------------------------------------------

-- Step 1: the user declares an intent. Nothing is credited here.
create or replace function create_deposit_intent(
  p_amount       numeric,
  p_network_code text
)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_profile   profiles%rowtype;
  v_network   supported_networks%rowtype;
  v_deposit   deposits%rowtype;
  v_open      integer;
  v_max_open  integer := get_setting_numeric('max_open_deposit_intents', 5)::int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = v_uid;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_network from supported_networks where code = upper(p_network_code) and active;
  if not found then
    raise exception 'NETWORK_NOT_SUPPORTED' using errcode = 'P0001';
  end if;
  if not v_network.deposit_enabled then
    raise exception 'DEPOSITS_DISABLED_FOR_NETWORK' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount < v_network.min_deposit then
    raise exception 'AMOUNT_BELOW_MINIMUM:%', v_network.min_deposit using errcode = 'P0001';
  end if;

  if not exists (select 1 from deposit_addresses where network_id = v_network.id and active) then
    raise exception 'NO_DEPOSIT_ADDRESS_CONFIGURED' using errcode = 'P0001';
  end if;

  select count(*) into v_open
  from deposits
  where user_id = v_uid and status = 'PENDING' and tx_hash is null;

  if v_open >= v_max_open then
    raise exception 'TOO_MANY_OPEN_DEPOSITS' using errcode = 'P0001';
  end if;

  insert into deposits (
    user_id, amount, currency, network_id, network_code, token_contract,
    to_address, required_confirmations, status, reference_code
  )
  values (
    v_uid,
    round(p_amount, 8),
    v_network.token_symbol,
    v_network.id,
    v_network.code,
    v_network.token_contract,
    (select address from deposit_addresses where network_id = v_network.id and active order by created_at limit 1),
    v_network.required_confirmations,
    'PENDING',
    'DP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  )
  returning * into v_deposit;

  return v_deposit;
end;
$$;

-- Step 2: the user attaches the on-chain transaction hash. Still not credited.
create or replace function attach_deposit_tx(p_deposit_id uuid, p_tx_hash text)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_deposit deposits%rowtype;
  v_hash    text := trim(p_tx_hash);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if v_hash is null or length(v_hash) < 10 then
    raise exception 'INVALID_TX_HASH' using errcode = '22023';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.user_id <> v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from deposits
    where network_code = v_deposit.network_code
      and lower(tx_hash) = lower(v_hash)
      and id <> v_deposit.id
  ) then
    raise exception 'TX_HASH_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  update deposits
  set tx_hash = v_hash, updated_at = now()
  where id = p_deposit_id
  returning * into v_deposit;

  return v_deposit;
end;
$$;

-- Step 3: server-only crediting, called ONLY after real chain verification.
-- Every fact stored here comes from the verified transaction, not the user.
create or replace function credit_verified_deposit(
  p_deposit_id     uuid,
  p_verified_amount numeric,
  p_from_address   text,
  p_to_address     text,
  p_token_contract text,
  p_confirmations  integer,
  p_payload        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deposit deposits%rowtype;
  v_entry   ledger_entries%rowtype;
begin
  perform assert_service_role();

  if p_verified_amount is null or p_verified_amount <= 0 then
    raise exception 'INVALID_VERIFIED_AMOUNT' using errcode = '22023';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotent: a transaction can never be credited twice.
  if v_deposit.status = 'CONFIRMED' then
    return jsonb_build_object('deposit_id', v_deposit.id, 'status', 'CONFIRMED', 'already_credited', true);
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_deposit.tx_hash is null then
    raise exception 'DEPOSIT_HAS_NO_TX_HASH' using errcode = 'P0001';
  end if;

  update deposits
  set status               = 'CONFIRMED',
      verified_amount      = round(p_verified_amount, 8),
      from_address         = coalesce(p_from_address, from_address),
      to_address           = coalesce(p_to_address, to_address),
      token_contract       = coalesce(p_token_contract, token_contract),
      confirmations        = greatest(coalesce(p_confirmations, 0), 0),
      verification_payload = coalesce(p_payload, '{}'::jsonb),
      last_checked_at      = now(),
      confirmed_at         = now(),
      updated_at           = now()
  where id = p_deposit_id
  returning * into v_deposit;

  v_entry := app_post_ledger(
    v_deposit.user_id,
    'DEPOSIT',
    v_deposit.verified_amount,
    'deposit',
    v_deposit.id,
    format('Verified %s deposit (%s)', v_deposit.network_code, left(v_deposit.tx_hash, 16) || '...'),
    null,
    v_deposit.currency
  );

  update deposits
  set ledger_entry_id = v_entry.id, credited_at = now()
  where id = p_deposit_id;

  perform app_notify(
    v_deposit.user_id,
    'Deposit confirmed',
    format('Your deposit of %s %s has been verified on %s and credited to your internal platform balance.',
           to_char(v_deposit.verified_amount, 'FM999999990.00'), v_deposit.currency, v_deposit.network_code),
    'SUCCESS',
    jsonb_build_object('event', 'deposit_confirmed', 'deposit_id', v_deposit.id, 'tx_hash', v_deposit.tx_hash)
  );

  return jsonb_build_object(
    'deposit_id',      v_deposit.id,
    'status',          'CONFIRMED',
    'credited_amount', v_deposit.verified_amount,
    'balance_after',   v_entry.balance_after,
    'already_credited', false
  );
end;
$$;

-- Record a failed / non-matching verification attempt without crediting.
create or replace function record_deposit_check(
  p_deposit_id    uuid,
  p_confirmations integer,
  p_payload       jsonb,
  p_reject_reason text default null
)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deposit deposits%rowtype;
begin
  perform assert_service_role();

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    return v_deposit;
  end if;

  update deposits
  set confirmations         = greatest(coalesce(p_confirmations, confirmations), 0),
      verification_payload  = coalesce(p_payload, verification_payload),
      verification_attempts = verification_attempts + 1,
      last_checked_at       = now(),
      status                = case when p_reject_reason is not null then 'REJECTED'::deposit_status else status end,
      rejection_reason      = coalesce(p_reject_reason, rejection_reason),
      updated_at            = now()
  where id = p_deposit_id
  returning * into v_deposit;

  if p_reject_reason is not null then
    perform app_notify(
      v_deposit.user_id,
      'Deposit could not be verified',
      format('Your %s deposit could not be verified: %s. Contact support if you believe this is an error.',
             v_deposit.network_code, p_reject_reason),
      'ERROR',
      jsonb_build_object('event', 'deposit_rejected', 'deposit_id', v_deposit.id)
    );
  end if;

  return v_deposit;
end;
$$;

-- ---------------------------------------------------------------------
-- Withdrawals
-- ---------------------------------------------------------------------

-- Pure read used by both the UI and request_withdrawal, so the number the
-- user sees and the rule the server enforces can never drift apart.
create or replace function withdrawal_eligibility(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile      profiles%rowtype;
  v_wait_days    integer := get_setting_numeric('first_withdrawal_wait_days', 30)::int;
  v_cooldown     integer := get_setting_numeric('withdrawal_cooldown_days', 10)::int;
  v_anchor_mode  text    := get_setting_text('first_withdrawal_anchor', 'VIP_ACTIVATION');
  v_anchor       timestamptz;
  v_has_paid     boolean;
  v_open         integer;
  v_eligible_at  timestamptz;
  v_reason       text := null;
begin
  if p_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select exists (select 1 from withdrawals where user_id = p_user_id and status = 'PAID') into v_has_paid;
  select count(*) into v_open from withdrawals where user_id = p_user_id and status in ('PENDING', 'PROCESSING');

  if v_anchor_mode = 'REGISTRATION' then
    v_anchor := v_profile.created_at;
  else
    v_anchor := v_profile.first_activation_at;
  end if;

  if v_has_paid then
    v_eligible_at := coalesce(v_profile.last_withdrawal_at, v_anchor) + make_interval(days => v_cooldown);
  elsif v_anchor is null then
    v_eligible_at := null;
    v_reason := 'NO_ACTIVATION';
  else
    v_eligible_at := v_anchor + make_interval(days => v_wait_days);
  end if;

  if v_profile.status <> 'ACTIVE' then
    v_reason := 'ACCOUNT_NOT_ACTIVE';
  elsif v_open > 0 then
    v_reason := 'WITHDRAWAL_ALREADY_PENDING';
  elsif v_reason is null and v_eligible_at is not null and now() < v_eligible_at then
    v_reason := case when v_has_paid then 'COOLDOWN_ACTIVE' else 'FIRST_WITHDRAWAL_WAITING_PERIOD' end;
  end if;

  return jsonb_build_object(
    'eligible',            v_reason is null,
    'reason',              v_reason,
    'is_first_withdrawal', not v_has_paid,
    'anchor_mode',         v_anchor_mode,
    'anchor_at',           v_anchor,
    'eligible_at',         v_eligible_at,
    'days_remaining',      case
                             when v_eligible_at is null then null
                             when now() >= v_eligible_at then 0
                             else ceil(extract(epoch from (v_eligible_at - now())) / 86400.0)::int
                           end,
    'first_withdrawal_wait_days', v_wait_days,
    'withdrawal_cooldown_days',   v_cooldown,
    'available_balance',   v_profile.balance_available,
    'pending_balance',     v_profile.balance_pending_withdrawal,
    'open_withdrawals',    v_open
  );
end;
$$;

create or replace function request_withdrawal(
  p_amount       numeric,
  p_network_code text,
  p_address      text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_profile     profiles%rowtype;
  v_network     supported_networks%rowtype;
  v_elig        jsonb;
  v_fee         numeric(20, 8);
  v_amount      numeric(20, 8);
  v_withdrawal  withdrawals%rowtype;
  v_entry       ledger_entries%rowtype;
  v_address     text := trim(p_address);
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Lock the profile first: this serialises concurrent withdrawal requests.
  select * into v_profile from profiles where id = v_uid for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_profile.status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_network from supported_networks where code = upper(p_network_code) and active;
  if not found then
    raise exception 'NETWORK_NOT_SUPPORTED' using errcode = 'P0001';
  end if;
  if not v_network.withdrawal_enabled then
    raise exception 'WITHDRAWALS_DISABLED_FOR_NETWORK' using errcode = 'P0001';
  end if;

  if v_address is null or v_address = '' or v_address !~ v_network.address_regex then
    raise exception 'INVALID_DESTINATION_ADDRESS' using errcode = 'P0001';
  end if;

  v_amount := round(p_amount, 8);
  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;
  if v_amount < v_network.min_withdrawal then
    raise exception 'AMOUNT_BELOW_MINIMUM:%', v_network.min_withdrawal using errcode = 'P0001';
  end if;

  v_fee := round(v_network.withdrawal_fee, 8);
  if v_amount <= v_fee then
    raise exception 'AMOUNT_DOES_NOT_COVER_FEE' using errcode = 'P0001';
  end if;

  if v_profile.balance_available < v_amount then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  v_elig := withdrawal_eligibility(v_uid);
  if not (v_elig ->> 'eligible')::boolean then
    raise exception 'NOT_ELIGIBLE:%', coalesce(v_elig ->> 'reason', 'UNKNOWN') using errcode = 'P0001';
  end if;

  insert into withdrawals (
    user_id, amount, fee, net_amount, currency, network_id, network_code,
    destination_address, status
  )
  values (
    v_uid, v_amount, v_fee, v_amount - v_fee, v_network.token_symbol,
    v_network.id, v_network.code, v_address, 'PENDING'
  )
  returning * into v_withdrawal;

  -- Lock the funds immediately so they cannot be spent twice.
  v_entry := app_post_ledger(
    v_uid,
    'WITHDRAWAL_HOLD',
    -v_amount,
    'withdrawal',
    v_withdrawal.id,
    format('Withdrawal request %s locked', left(v_withdrawal.id::text, 8)),
    v_uid,
    v_network.token_symbol
  );

  update withdrawals set hold_ledger_id = v_entry.id where id = v_withdrawal.id;

  perform app_notify(
    v_uid,
    'Withdrawal request received',
    format('Your withdrawal request for %s %s has been received and the amount is now locked. '
           || 'Withdrawals are settled manually by the platform team.',
           to_char(v_amount, 'FM999999990.00'), v_network.token_symbol),
    'INFO',
    jsonb_build_object('event', 'withdrawal_requested', 'withdrawal_id', v_withdrawal.id)
  );

  return jsonb_build_object(
    'withdrawal_id',     v_withdrawal.id,
    'amount',            v_amount,
    'fee',               v_fee,
    'net_amount',        v_amount - v_fee,
    'available_balance', v_entry.balance_after,
    'status',            'PENDING'
  );
end;
$$;

create or replace function cancel_withdrawal(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_withdrawal withdrawals%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_withdrawal.user_id <> v_uid then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_withdrawal.status <> 'PENDING' then
    raise exception 'WITHDRAWAL_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  update withdrawals
  set status = 'CANCELLED', processed_at = now(), updated_at = now()
  where id = p_withdrawal_id;

  perform app_post_ledger(
    v_uid,
    'WITHDRAWAL_RELEASE',
    v_withdrawal.amount,
    'withdrawal',
    v_withdrawal.id,
    'Withdrawal cancelled by user, funds released',
    v_uid,
    v_withdrawal.currency
  );

  return jsonb_build_object('withdrawal_id', v_withdrawal.id, 'status', 'CANCELLED');
end;
$$;

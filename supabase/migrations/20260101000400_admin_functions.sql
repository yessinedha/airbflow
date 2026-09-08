-- =====================================================================
-- 20260101000400_admin_functions.sql
-- Administrative operations. Every function re-checks the caller's role
-- server side via assert_admin() and writes an audit record.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Withdrawal settlement (manual, off-platform payment by an operator)
-- ---------------------------------------------------------------------
create or replace function admin_start_withdrawal_processing(p_withdrawal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin      uuid := assert_admin();
  v_withdrawal withdrawals%rowtype;
begin
  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_withdrawal.status <> 'PENDING' then
    raise exception 'INVALID_WITHDRAWAL_STATE' using errcode = 'P0001';
  end if;

  update withdrawals
  set status = 'PROCESSING', processed_by = v_admin, processed_at = now(), updated_at = now()
  where id = p_withdrawal_id;

  perform log_admin_action(v_admin, 'withdrawal.processing', 'withdrawal', p_withdrawal_id,
                           jsonb_build_object('amount', v_withdrawal.amount));

  perform app_notify(
    v_withdrawal.user_id,
    'Withdrawal is being processed',
    'Your withdrawal request has been approved and is being processed for manual payment.',
    'INFO',
    jsonb_build_object('event', 'withdrawal_processing', 'withdrawal_id', p_withdrawal_id)
  );

  return jsonb_build_object('withdrawal_id', p_withdrawal_id, 'status', 'PROCESSING');
end;
$$;

-- The operator has already sent the real transaction from an external
-- wallet. The platform only records the resulting hash: it never holds a
-- private key and never signs anything.
create or replace function admin_mark_withdrawal_paid(
  p_withdrawal_id uuid,
  p_tx_hash       text,
  p_note          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin      uuid := assert_admin();
  v_withdrawal withdrawals%rowtype;
  v_hash       text := trim(p_tx_hash);
begin
  if v_hash is null or length(v_hash) < 10 then
    raise exception 'INVALID_TX_HASH' using errcode = '22023';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_withdrawal.status not in ('PENDING', 'PROCESSING') then
    raise exception 'INVALID_WITHDRAWAL_STATE' using errcode = 'P0001';
  end if;

  if exists (select 1 from withdrawals where lower(tx_hash) = lower(v_hash) and id <> p_withdrawal_id) then
    raise exception 'TX_HASH_ALREADY_USED' using errcode = 'P0001';
  end if;

  update withdrawals
  set status       = 'PAID',
      tx_hash      = v_hash,
      admin_note   = coalesce(p_note, admin_note),
      processed_by = v_admin,
      processed_at = coalesce(processed_at, now()),
      paid_at      = now(),
      updated_at   = now()
  where id = p_withdrawal_id;

  -- Releases the locked funds out of the platform for good.
  perform app_post_ledger(
    v_withdrawal.user_id,
    'WITHDRAWAL_COMPLETED',
    -v_withdrawal.amount,
    'withdrawal',
    v_withdrawal.id,
    format('Withdrawal paid, tx %s', v_hash),
    v_admin,
    v_withdrawal.currency
  );

  update profiles
  set last_withdrawal_at = now(), updated_at = now()
  where id = v_withdrawal.user_id;

  perform log_admin_action(v_admin, 'withdrawal.paid', 'withdrawal', p_withdrawal_id,
                           jsonb_build_object('amount', v_withdrawal.amount, 'tx_hash', v_hash));

  perform app_notify(
    v_withdrawal.user_id,
    'Withdrawal paid',
    format('Your withdrawal of %s %s has been paid. Transaction hash: %s',
           to_char(v_withdrawal.net_amount, 'FM999999990.00'), v_withdrawal.currency, v_hash),
    'SUCCESS',
    jsonb_build_object('event', 'withdrawal_paid', 'withdrawal_id', p_withdrawal_id, 'tx_hash', v_hash)
  );

  return jsonb_build_object('withdrawal_id', p_withdrawal_id, 'status', 'PAID', 'tx_hash', v_hash);
end;
$$;

create or replace function admin_reject_withdrawal(p_withdrawal_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin      uuid := assert_admin();
  v_withdrawal withdrawals%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_withdrawal.status not in ('PENDING', 'PROCESSING') then
    raise exception 'INVALID_WITHDRAWAL_STATE' using errcode = 'P0001';
  end if;

  update withdrawals
  set status           = 'REJECTED',
      rejection_reason = p_reason,
      processed_by     = v_admin,
      processed_at     = now(),
      updated_at       = now()
  where id = p_withdrawal_id;

  -- Locked funds go back to the available balance.
  perform app_post_ledger(
    v_withdrawal.user_id,
    'WITHDRAWAL_RELEASE',
    v_withdrawal.amount,
    'withdrawal',
    v_withdrawal.id,
    'Withdrawal rejected, funds released',
    v_admin,
    v_withdrawal.currency
  );

  perform log_admin_action(v_admin, 'withdrawal.rejected', 'withdrawal', p_withdrawal_id,
                           jsonb_build_object('amount', v_withdrawal.amount, 'reason', p_reason));

  perform app_notify(
    v_withdrawal.user_id,
    'Withdrawal rejected',
    format('Your withdrawal request was rejected: %s. The locked amount has been returned to your balance.', p_reason),
    'WARNING',
    jsonb_build_object('event', 'withdrawal_rejected', 'withdrawal_id', p_withdrawal_id)
  );

  return jsonb_build_object('withdrawal_id', p_withdrawal_id, 'status', 'REJECTED');
end;
$$;

-- ---------------------------------------------------------------------
-- Deposit exception handling
-- ---------------------------------------------------------------------

-- Manual confirmation exists for genuine exceptions only (for example a
-- provider outage). It demands a real transaction hash, a real amount and
-- a written reason, and is always audited.
create or replace function admin_confirm_deposit(
  p_deposit_id uuid,
  p_amount     numeric,
  p_tx_hash    text,
  p_reason     text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin   uuid := assert_admin();
  v_deposit deposits%rowtype;
  v_entry   ledger_entries%rowtype;
  v_hash    text := trim(p_tx_hash);
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if v_hash is null or length(v_hash) < 10 then
    raise exception 'INVALID_TX_HASH' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from deposits
    where network_code = v_deposit.network_code and lower(tx_hash) = lower(v_hash) and id <> p_deposit_id
  ) then
    raise exception 'TX_HASH_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  update deposits
  set status               = 'CONFIRMED',
      tx_hash              = v_hash,
      verified_amount      = round(p_amount, 8),
      confirmed_at         = now(),
      credited_at          = now(),
      updated_at           = now(),
      verification_payload = verification_payload
                             || jsonb_build_object('manual_review', true, 'admin_id', v_admin, 'reason', p_reason)
  where id = p_deposit_id
  returning * into v_deposit;

  v_entry := app_post_ledger(
    v_deposit.user_id,
    'DEPOSIT',
    v_deposit.verified_amount,
    'deposit',
    v_deposit.id,
    format('Deposit confirmed by manual review (%s)', v_hash),
    v_admin,
    v_deposit.currency
  );

  update deposits set ledger_entry_id = v_entry.id where id = p_deposit_id;

  perform log_admin_action(v_admin, 'deposit.manual_confirm', 'deposit', p_deposit_id,
                           jsonb_build_object('amount', v_deposit.verified_amount, 'tx_hash', v_hash, 'reason', p_reason));

  perform app_notify(
    v_deposit.user_id,
    'Deposit confirmed',
    format('Your deposit of %s %s has been confirmed and credited to your internal platform balance.',
           to_char(v_deposit.verified_amount, 'FM999999990.00'), v_deposit.currency),
    'SUCCESS',
    jsonb_build_object('event', 'deposit_confirmed', 'deposit_id', p_deposit_id)
  );

  return jsonb_build_object('deposit_id', p_deposit_id, 'status', 'CONFIRMED', 'amount', v_deposit.verified_amount);
end;
$$;

create or replace function admin_reject_deposit(p_deposit_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin   uuid := assert_admin();
  v_deposit deposits%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;

  update deposits
  set status = 'REJECTED', rejection_reason = p_reason, updated_at = now()
  where id = p_deposit_id;

  perform log_admin_action(v_admin, 'deposit.rejected', 'deposit', p_deposit_id,
                           jsonb_build_object('reason', p_reason));

  perform app_notify(
    v_deposit.user_id,
    'Deposit rejected',
    format('Your deposit request was rejected: %s', p_reason),
    'ERROR',
    jsonb_build_object('event', 'deposit_rejected', 'deposit_id', p_deposit_id)
  );

  return jsonb_build_object('deposit_id', p_deposit_id, 'status', 'REJECTED');
end;
$$;

-- ---------------------------------------------------------------------
-- User management
-- ---------------------------------------------------------------------
create or replace function admin_adjust_balance(
  p_user_id uuid,
  p_amount  numeric,
  p_reason  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_entry ledger_entries%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  v_entry := app_post_ledger(
    p_user_id,
    'ADMIN_ADJUSTMENT',
    round(p_amount, 8),
    'admin_adjustment',
    null,
    p_reason,
    v_admin
  );

  perform log_admin_action(v_admin, 'balance.adjusted', 'profile', p_user_id,
                           jsonb_build_object('amount', p_amount, 'reason', p_reason,
                                              'balance_after', v_entry.balance_after));

  perform app_notify(
    p_user_id,
    'Balance adjustment',
    format('An adjustment of %s USDT was applied to your internal platform balance. Reason: %s',
           to_char(round(p_amount, 2), 'FM999999990.00'), p_reason),
    'INFO',
    jsonb_build_object('event', 'admin_adjustment', 'amount', p_amount)
  );

  return jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'balance_after', v_entry.balance_after);
end;
$$;

create or replace function admin_set_user_status(
  p_user_id uuid,
  p_status  user_status,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin  uuid := assert_admin();
  v_target profiles%rowtype;
begin
  select * into v_target from profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Only a super admin may act on another privileged account.
  if v_target.role in ('ADMIN', 'SUPER_ADMIN') and not is_super_admin(v_admin) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if v_target.id = v_admin then
    raise exception 'CANNOT_MODIFY_OWN_STATUS' using errcode = 'P0001';
  end if;

  update profiles set status = p_status, updated_at = now() where id = p_user_id;

  perform log_admin_action(v_admin, 'user.status_changed', 'profile', p_user_id,
                           jsonb_build_object('from', v_target.status, 'to', p_status, 'reason', p_reason));

  perform app_notify(
    p_user_id,
    'Account status updated',
    format('Your account status is now %s.%s', p_status,
           case when p_reason is null then '' else ' Reason: ' || p_reason end),
    case when p_status = 'ACTIVE' then 'SUCCESS' else 'WARNING' end::notification_type,
    jsonb_build_object('event', 'status_changed', 'status', p_status)
  );

  return jsonb_build_object('user_id', p_user_id, 'status', p_status);
end;
$$;

create or replace function admin_set_user_role(p_user_id uuid, p_role user_role)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_old   user_role;
begin
  if v_admin is null or not is_super_admin(v_admin) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_user_id = v_admin then
    raise exception 'CANNOT_MODIFY_OWN_ROLE' using errcode = 'P0001';
  end if;

  select role into v_old from profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  update profiles set role = p_role, updated_at = now() where id = p_user_id;

  perform log_admin_action(v_admin, 'user.role_changed', 'profile', p_user_id,
                           jsonb_build_object('from', v_old, 'to', p_role));

  return jsonb_build_object('user_id', p_user_id, 'role', p_role);
end;
$$;

-- ---------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------
create or replace function admin_set_setting(p_key text, p_value jsonb, p_description text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_old   jsonb;
begin
  select value into v_old from platform_settings where key = p_key;

  insert into platform_settings (key, value, description, updated_by, updated_at)
  values (p_key, p_value, p_description, v_admin, now())
  on conflict (key) do update
    set value       = excluded.value,
        description = coalesce(excluded.description, platform_settings.description),
        updated_by  = excluded.updated_by,
        updated_at  = now();

  perform log_admin_action(v_admin, 'setting.updated', 'platform_setting', null,
                           jsonb_build_object('key', p_key, 'from', v_old, 'to', p_value));

  return jsonb_build_object('key', p_key, 'value', p_value);
end;
$$;

-- ---------------------------------------------------------------------
-- Dashboard statistics
-- ---------------------------------------------------------------------
create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := app_today();
begin
  perform assert_admin();

  return jsonb_build_object(
    'total_users',            (select count(*) from profiles),
    'active_users',           (select count(*) from profiles where status = 'ACTIVE'),
    'suspended_users',        (select count(*) from profiles where status <> 'ACTIVE'),
    'new_users_today',        (select count(*) from profiles where created_at >= v_today),
    'vip_users',              (select count(*) from profiles where current_vip_plan_id is not null),
    'pending_deposits',       (select count(*) from deposits where status = 'PENDING'),
    'confirmed_deposits',     (select count(*) from deposits where status = 'CONFIRMED'),
    'deposit_volume',         (select coalesce(sum(verified_amount), 0) from deposits where status = 'CONFIRMED'),
    'pending_withdrawals',    (select count(*) from withdrawals where status in ('PENDING', 'PROCESSING')),
    'pending_withdrawal_amount',
                              (select coalesce(sum(amount), 0) from withdrawals where status in ('PENDING', 'PROCESSING')),
    'completed_withdrawals',  (select count(*) from withdrawals where status = 'PAID'),
    'withdrawal_volume',      (select coalesce(sum(amount), 0) from withdrawals where status = 'PAID'),
    'tasks_completed_today',  (select count(*) from task_assignments where assigned_date = v_today and status = 'COMPLETED'),
    'rewards_issued_today',   (select coalesce(sum(amount), 0) from ledger_entries
                                where type = 'TASK_REWARD' and created_at >= v_today),
    'referral_rewards_today', (select coalesce(sum(amount), 0) from ledger_entries
                                where type = 'REFERRAL_REWARD' and created_at >= v_today),
    'referrals_today',        (select count(*) from referrals where level = 1 and created_at >= v_today),
    'total_referrals',        (select count(*) from referrals where level = 1),
    'total_liability',        (select coalesce(sum(balance_available + balance_pending_withdrawal), 0) from profiles)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Referral tree read model (own team only, or any team for admins)
-- ---------------------------------------------------------------------
create or replace function get_team_summary(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_user_id <> v_uid and not is_admin(v_uid) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'level1',      (select count(*) from referrals where referrer_id = p_user_id and level = 1),
    'level2',      (select count(*) from referrals where referrer_id = p_user_id and level = 2),
    'level3',      (select count(*) from referrals where referrer_id = p_user_id and level = 3),
    'total',       (select count(*) from referrals where referrer_id = p_user_id),
    'active_members', (select count(*) from referrals r join profiles p on p.id = r.referred_user_id
                        where r.referrer_id = p_user_id and p.current_vip_plan_id is not null),
    'total_commission', (select coalesce(sum(amount), 0) from ledger_entries
                          where user_id = p_user_id and type = 'REFERRAL_REWARD')
  );
end;
$$;

create or replace function get_team_members(p_user_id uuid default auth.uid(), p_level smallint default null)
returns table (
  user_id       uuid,
  username      text,
  masked_email  text,
  level         smallint,
  joined_at     timestamptz,
  vip_plan      text,
  is_active     boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_user_id <> v_uid and not is_admin(v_uid) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return query
    select
      p.id,
      p.username::text,
      -- Team members are other people: never expose their full contact data.
      (left(p.email::text, 2) || '***@' || split_part(p.email::text, '@', 2))::text,
      r.level,
      r.created_at,
      coalesce(v.name, '')::text,
      (p.status = 'ACTIVE')
    from referrals r
    join profiles p on p.id = r.referred_user_id
    left join vip_plans v on v.id = p.current_vip_plan_id
    where r.referrer_id = p_user_id
      and (p_level is null or r.level = p_level)
    order by r.level, r.created_at desc;
end;
$$;

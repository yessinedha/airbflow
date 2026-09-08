-- =====================================================================
-- 20260101000200_triggers.sql
-- Integrity triggers: updated_at, ledger immutability, profile guards,
-- and invitation-only account provisioning.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'platform_settings', 'vip_plans', 'profiles', 'tasks',
    'supported_networks', 'deposit_addresses', 'deposits', 'withdrawals'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on %1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on %1$I
       for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- The ledger is append only. Corrections are made with compensating
-- entries (ADMIN_ADJUSTMENT / REFUND), never by rewriting history.
-- ---------------------------------------------------------------------
create or replace function forbid_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'LEDGER_IS_IMMUTABLE: % on ledger_entries is not permitted', tg_op
    using errcode = '42501';
end;
$$;

drop trigger if exists trg_ledger_immutable on ledger_entries;
create trigger trg_ledger_immutable
  before update or delete on ledger_entries
  for each row execute function forbid_ledger_mutation();

-- VIP history and audit logs are equally append only.
drop trigger if exists trg_vip_history_immutable on user_vip_plans;
create trigger trg_vip_history_immutable
  before update or delete on user_vip_plans
  for each row execute function forbid_ledger_mutation();

drop trigger if exists trg_admin_actions_immutable on admin_actions;
create trigger trg_admin_actions_immutable
  before update or delete on admin_actions
  for each row execute function forbid_ledger_mutation();

-- ---------------------------------------------------------------------
-- Profile guard
--   * identity / referral fields can never change after creation
--   * balances change only from inside app_post_ledger()
--   * role and status change only for super admins or the service role
-- ---------------------------------------------------------------------
create or replace function guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ledger_ctx   boolean := coalesce(current_setting('app.ledger_ctx', true), '') = '1';
  v_caller       uuid := auth.uid();
  v_is_service   boolean := coalesce(current_setting('request.jwt.claim.role', true), coalesce(auth.role(), '')) = 'service_role';
  v_privileged   boolean;
begin
  v_privileged := v_is_service or v_caller is null or is_super_admin(v_caller);

  if new.id is distinct from old.id then
    raise exception 'PROFILE_ID_IMMUTABLE' using errcode = '42501';
  end if;

  if new.referral_code is distinct from old.referral_code then
    raise exception 'REFERRAL_CODE_IMMUTABLE' using errcode = '42501';
  end if;

  if new.referred_by is distinct from old.referred_by then
    raise exception 'REFERRER_IMMUTABLE' using errcode = '42501';
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'CREATED_AT_IMMUTABLE' using errcode = '42501';
  end if;

  if not v_ledger_ctx and (
       new.balance_available          is distinct from old.balance_available
    or new.balance_pending_withdrawal is distinct from old.balance_pending_withdrawal
    or new.total_deposited            is distinct from old.total_deposited
    or new.total_rewards              is distinct from old.total_rewards
    or new.total_withdrawn            is distinct from old.total_withdrawn
  ) then
    raise exception 'BALANCE_CHANGES_REQUIRE_LEDGER_ENTRY' using errcode = '42501';
  end if;

  if not v_privileged and (
       new.role   is distinct from old.role
    or new.status is distinct from old.status
  ) then
    raise exception 'ROLE_OR_STATUS_CHANGE_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_update on profiles;
create trigger trg_guard_profile_update
  before update on profiles
  for each row execute function guard_profile_update();

-- app_post_ledger must announce itself so the guard lets the balance move.
create or replace function app_post_ledger(
  p_user_id        uuid,
  p_type           ledger_type,
  p_amount         numeric,
  p_reference_type text default null,
  p_reference_id   uuid default null,
  p_description    text default null,
  p_created_by     uuid default null,
  p_currency       text default 'USDT'
)
returns ledger_entries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile        profiles%rowtype;
  v_available_d    numeric(20, 8) := 0;
  v_pending_d      numeric(20, 8) := 0;
  v_new_available  numeric(20, 8);
  v_new_pending    numeric(20, 8);
  v_entry          ledger_entries%rowtype;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select * into v_profile from profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  case p_type
    when 'DEPOSIT', 'TASK_REWARD', 'REFERRAL_REWARD', 'REFUND' then
      if p_amount <= 0 then
        raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22023';
      end if;
      v_available_d := p_amount;

    when 'VIP_ACTIVATION' then
      if p_amount >= 0 then
        raise exception 'AMOUNT_MUST_BE_NEGATIVE_FOR_VIP_ACTIVATION' using errcode = '22023';
      end if;
      v_available_d := p_amount;

    when 'ADMIN_ADJUSTMENT' then
      v_available_d := p_amount;

    when 'WITHDRAWAL_HOLD' then
      if p_amount >= 0 then
        raise exception 'AMOUNT_MUST_BE_NEGATIVE_FOR_WITHDRAWAL_HOLD' using errcode = '22023';
      end if;
      v_available_d := p_amount;
      v_pending_d   := -p_amount;

    when 'WITHDRAWAL_RELEASE' then
      if p_amount <= 0 then
        raise exception 'AMOUNT_MUST_BE_POSITIVE_FOR_WITHDRAWAL_RELEASE' using errcode = '22023';
      end if;
      v_available_d := p_amount;
      v_pending_d   := -p_amount;

    when 'WITHDRAWAL_COMPLETED' then
      if p_amount >= 0 then
        raise exception 'AMOUNT_MUST_BE_NEGATIVE_FOR_WITHDRAWAL_COMPLETED' using errcode = '22023';
      end if;
      v_available_d := 0;
      v_pending_d   := p_amount;

    else
      raise exception 'UNSUPPORTED_LEDGER_TYPE' using errcode = '22023';
  end case;

  v_new_available := v_profile.balance_available + v_available_d;
  v_new_pending   := v_profile.balance_pending_withdrawal + v_pending_d;

  if v_new_available < 0 then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;
  if v_new_pending < 0 then
    raise exception 'INSUFFICIENT_PENDING_BALANCE' using errcode = 'P0001';
  end if;

  perform set_config('app.ledger_ctx', '1', true);

  update profiles
  set balance_available          = v_new_available,
      balance_pending_withdrawal = v_new_pending,
      total_deposited            = total_deposited + case when p_type = 'DEPOSIT' then p_amount else 0 end,
      total_rewards              = total_rewards
                                     + case when p_type in ('TASK_REWARD', 'REFERRAL_REWARD') then p_amount else 0 end,
      total_withdrawn            = total_withdrawn + case when p_type = 'WITHDRAWAL_COMPLETED' then -p_amount else 0 end,
      updated_at                 = now()
  where id = p_user_id;

  perform set_config('app.ledger_ctx', '0', true);

  insert into ledger_entries (
    user_id, type, amount, currency, reference_type, reference_id,
    balance_before, balance_after, description, created_by
  )
  values (
    p_user_id, p_type, p_amount, coalesce(p_currency, 'USDT'), p_reference_type, p_reference_id,
    v_profile.balance_available, v_new_available, p_description, p_created_by
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function app_post_ledger(uuid, ledger_type, numeric, text, uuid, text, uuid, text) from public;
revoke all on function app_post_ledger(uuid, ledger_type, numeric, text, uuid, text, uuid, text) from anon;
revoke all on function app_post_ledger(uuid, ledger_type, numeric, text, uuid, text, uuid, text) from authenticated;

-- ---------------------------------------------------------------------
-- Invitation-only provisioning.
--
-- Runs inside the auth.users insert transaction, so an invalid invitation
-- code aborts account creation atomically: no orphan auth user is left
-- behind. The very first account on a fresh install becomes SUPER_ADMIN
-- and is the only account allowed to exist without an inviter.
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ref_code      text := nullif(upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), '');
  v_username      text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  v_referrer      profiles%rowtype;
  v_is_first_user boolean;
  v_new_code      text;
  v_level1        uuid;
  v_level2        uuid;
begin
  select not exists (select 1 from profiles) into v_is_first_user;

  if v_is_first_user then
    v_new_code := generate_referral_code();
    insert into profiles (id, email, username, referral_code, referred_by, role, status)
    values (new.id, new.email, coalesce(v_username, split_part(new.email, '@', 1)), v_new_code, null, 'SUPER_ADMIN', 'ACTIVE');
    return new;
  end if;

  if v_ref_code is null then
    raise exception 'INVITATION_CODE_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_referrer from profiles where referral_code = v_ref_code;
  if not found then
    raise exception 'INVALID_INVITATION_CODE' using errcode = 'P0001';
  end if;

  if v_referrer.status <> 'ACTIVE' then
    raise exception 'INVITER_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if v_referrer.id = new.id then
    raise exception 'SELF_REFERRAL_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  v_new_code := generate_referral_code();

  insert into profiles (id, email, username, referral_code, referred_by, role, status)
  values (new.id, new.email, coalesce(v_username, split_part(new.email, '@', 1)), v_new_code, v_referrer.id, 'USER', 'ACTIVE');

  -- Materialise up to three ancestor levels.
  insert into referrals (referrer_id, referred_user_id, level)
  values (v_referrer.id, new.id, 1);

  select referrer_id into v_level1 from referrals where referred_user_id = v_referrer.id and level = 1;
  if v_level1 is not null and v_level1 <> new.id then
    insert into referrals (referrer_id, referred_user_id, level)
    values (v_level1, new.id, 2)
    on conflict do nothing;

    select referrer_id into v_level2 from referrals where referred_user_id = v_referrer.id and level = 2;
    if v_level2 is not null and v_level2 <> new.id then
      insert into referrals (referrer_id, referred_user_id, level)
      values (v_level2, new.id, 3)
      on conflict do nothing;
    end if;
  end if;

  perform app_notify(
    v_referrer.id,
    'New team member joined',
    format('%s joined your team using your invitation link.', coalesce(v_username, split_part(new.email, '@', 1))),
    'INFO',
    jsonb_build_object('event', 'referral_joined', 'user_id', new.id)
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep the profile email in sync when a user changes it through Supabase Auth.
create or replace function handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function handle_user_email_change();

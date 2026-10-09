-- =====================================================================
-- full-setup.sql  —  GENERATED FILE, DO NOT EDIT
--
-- Produced by `npm run db:bundle` from supabase/migrations/*.sql plus
-- supabase/seed.sql, in that order.
--
-- Paste the whole file into the Supabase SQL Editor and run it. Safe to run
-- more than once.
--
-- Source files, in order:
--   20260101000000_init_schema.sql
--   20260101000100_core_functions.sql
--   20260101000200_triggers.sql
--   20260101000300_business_functions.sql
--   20260101000400_admin_functions.sql
--   20260101000500_rls.sql
--   20260101000600_bootstrap_invitation.sql
--   20260101000700_task_images.sql
--   20260101000800_task_images_reload.sql
--   20260101000900_fix_task_image_check.sql
--   20260101001000_single_pending_deposit.sql
--   20260101001100_admin_delete_user.sql
--   20260929000000_crypto_market_analysis_copy.sql
--   20261001000000_admin_user_referral_controls.sql
--   20261008000000_manual_deposit_proofs.sql
--   20261008200000_vip_withdrawal_fees.sql
--   20261009120000_withdrawal_task_lock.sql
--   20261009140000_optional_withdrawal_tx_hash.sql
--   seed.sql
-- =====================================================================


-- ###########################################################
-- ## 20260101000000_init_schema.sql
-- ###########################################################

-- =====================================================================
-- 20260101000000_init_schema.sql
-- Core schema: extensions, enums, tables, constraints, indexes.
--
-- Money model
-- -----------
-- `ledger_entries` is the immutable source of truth for every balance
-- change. `profiles.balance_available` / `profiles.balance_pending_withdrawal`
-- are denormalised running totals that may ONLY be modified by
-- `app_post_ledger()` (see 20260101000100_core_functions.sql), which writes
-- the matching ledger row in the same transaction while holding a row lock.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('USER', 'ADMIN', 'SUPER_ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('ACTIVE', 'SUSPENDED', 'BANNED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_type as enum (
    'DEPOSIT',
    'TASK_REWARD',
    'REFERRAL_REWARD',
    'VIP_ACTIVATION',
    'WITHDRAWAL_HOLD',
    'WITHDRAWAL_RELEASE',
    'WITHDRAWAL_COMPLETED',
    'ADMIN_ADJUSTMENT',
    'REFUND'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type deposit_status as enum ('PENDING', 'CONFIRMED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type withdrawal_status as enum ('PENDING', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assignment_status as enum ('AVAILABLE', 'STARTED', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'EXPIRED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_type as enum ('INFO', 'SUCCESS', 'WARNING', 'ERROR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_difficulty as enum ('EASY', 'MEDIUM', 'HARD');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- platform_settings : single source of tunable business parameters
-- ---------------------------------------------------------------------
create table if not exists platform_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- ---------------------------------------------------------------------
-- vip_plans
-- ---------------------------------------------------------------------
create table if not exists vip_plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  level             integer not null unique,
  activation_amount numeric(20, 8) not null check (activation_amount > 0),
  daily_task_limit  integer not null default 3 check (daily_task_limit between 1 and 20),
  -- Configurable TASK REWARD parameter: the share of the activation amount
  -- that forms the daily task reward pool. This is an operational reward
  -- budget, NOT a guaranteed or promised investment return.
  reward_rate       numeric(12, 8) not null default 0 check (reward_rate >= 0 and reward_rate <= 1),
  active            boolean not null default true,
  description       text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id                          uuid primary key references auth.users (id) on delete cascade,
  email                       citext not null unique,
  username                    citext unique,
  referral_code               text not null unique check (referral_code ~ '^[A-Z0-9]{6,12}$'),
  referred_by                 uuid references profiles (id) on delete set null,
  status                      user_status not null default 'ACTIVE',
  role                        user_role not null default 'USER',

  balance_available           numeric(20, 8) not null default 0 check (balance_available >= 0),
  balance_pending_withdrawal  numeric(20, 8) not null default 0 check (balance_pending_withdrawal >= 0),
  total_deposited             numeric(20, 8) not null default 0 check (total_deposited >= 0),
  total_rewards               numeric(20, 8) not null default 0 check (total_rewards >= 0),
  total_withdrawn             numeric(20, 8) not null default 0 check (total_withdrawn >= 0),

  current_vip_plan_id         uuid references vip_plans (id) on delete set null,
  vip_activated_at            timestamptz,
  first_activation_at         timestamptz,
  last_withdrawal_at          timestamptz,

  two_factor_enabled          boolean not null default false,
  two_factor_secret           text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint profiles_no_self_referral check (referred_by is null or referred_by <> id)
);

create index if not exists idx_profiles_referral_code on profiles (referral_code);
create index if not exists idx_profiles_referred_by on profiles (referred_by);
create index if not exists idx_profiles_role on profiles (role);
create index if not exists idx_profiles_status on profiles (status);
create index if not exists idx_profiles_created_at on profiles (created_at desc);

-- ---------------------------------------------------------------------
-- user_vip_plans : immutable VIP activation / upgrade history
-- ---------------------------------------------------------------------
create table if not exists user_vip_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references profiles (id) on delete cascade,
  previous_plan_id  uuid references vip_plans (id) on delete set null,
  new_plan_id       uuid not null references vip_plans (id) on delete restrict,
  previous_capital  numeric(20, 8) not null default 0,
  new_capital       numeric(20, 8) not null,
  amount_charged    numeric(20, 8) not null check (amount_charged >= 0),
  activated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_user_vip_plans_user on user_vip_plans (user_id, activated_at desc);

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
create table if not exists tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null,
  task_type        text not null,
  -- When set, overrides the VIP-derived reward. When null the reward is
  -- computed from the user's active VIP plan at claim time.
  reward_amount    numeric(20, 8) check (reward_amount is null or reward_amount >= 0),
  duration_seconds integer not null default 180 check (duration_seconds between 30 and 86400),
  difficulty       task_difficulty not null default 'EASY',
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_tasks_active on tasks (active, sort_order);

-- ---------------------------------------------------------------------
-- task_assignments
-- ---------------------------------------------------------------------
create table if not exists task_assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles (id) on delete cascade,
  task_id          uuid not null references tasks (id) on delete restrict,
  assigned_date    date not null,
  slot             smallint not null check (slot between 1 and 20),
  status           assignment_status not null default 'AVAILABLE',
  started_at       timestamptz,
  completed_at     timestamptz,
  duration_seconds integer not null default 180 check (duration_seconds between 30 and 86400),
  reward_amount    numeric(20, 8) not null default 0 check (reward_amount >= 0),
  vip_plan_id      uuid references vip_plans (id) on delete set null,
  submission_data  jsonb not null default '{}'::jsonb,
  ledger_entry_id  uuid,
  created_at       timestamptz not null default now(),

  -- One task per slot per day, and the same task can never be assigned twice
  -- to the same user on the same day. Duplicate reward prevention at DB level.
  constraint uq_assignment_user_date_slot unique (user_id, assigned_date, slot),
  constraint uq_assignment_user_date_task unique (user_id, assigned_date, task_id),
  constraint chk_started_at_required check (status = 'AVAILABLE' or started_at is not null),
  constraint chk_completed_consistency check (status <> 'COMPLETED' or completed_at is not null)
);

create index if not exists idx_assignments_user_date on task_assignments (user_id, assigned_date desc);
create index if not exists idx_assignments_status on task_assignments (status);
create index if not exists idx_assignments_completed_at on task_assignments (completed_at desc);

-- ---------------------------------------------------------------------
-- referrals : materialised ancestor chain, up to 3 levels
-- ---------------------------------------------------------------------
create table if not exists referrals (
  id               uuid primary key default gen_random_uuid(),
  referrer_id      uuid not null references profiles (id) on delete cascade,
  referred_user_id uuid not null references profiles (id) on delete cascade,
  level            smallint not null check (level between 1 and 3),
  created_at       timestamptz not null default now(),

  -- Exactly one ancestor per level per user: makes the referral tree tamper proof.
  constraint uq_referral_user_level unique (referred_user_id, level),
  constraint chk_referral_not_self check (referrer_id <> referred_user_id)
);

create index if not exists idx_referrals_referrer on referrals (referrer_id, level);
create index if not exists idx_referrals_referred on referrals (referred_user_id);

-- ---------------------------------------------------------------------
-- supported_networks + deposit_addresses
-- ---------------------------------------------------------------------
create table if not exists supported_networks (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  name                   text not null,
  chain                  text not null,
  token_symbol           text not null default 'USDT',
  token_contract         text not null,
  token_decimals         integer not null default 6 check (token_decimals between 0 and 36),
  required_confirmations integer not null default 19 check (required_confirmations >= 0),
  address_regex          text not null default '.+',
  explorer_tx_url        text,
  min_deposit            numeric(20, 8) not null default 1 check (min_deposit >= 0),
  min_withdrawal         numeric(20, 8) not null default 10 check (min_withdrawal >= 0),
  withdrawal_fee         numeric(20, 8) not null default 0 check (withdrawal_fee >= 0),
  deposit_enabled        boolean not null default true,
  withdrawal_enabled     boolean not null default true,
  active                 boolean not null default true,
  sort_order             integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table if not exists deposit_addresses (
  id         uuid primary key default gen_random_uuid(),
  network_id uuid not null references supported_networks (id) on delete cascade,
  address    text not null,
  label      text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_deposit_address unique (network_id, address)
);

create index if not exists idx_deposit_addresses_network on deposit_addresses (network_id, active);

-- ---------------------------------------------------------------------
-- deposits
-- ---------------------------------------------------------------------
create table if not exists deposits (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references profiles (id) on delete cascade,
  amount                 numeric(20, 8) not null check (amount > 0),
  verified_amount        numeric(20, 8) check (verified_amount is null or verified_amount > 0),
  currency               text not null default 'USDT',
  network_id             uuid references supported_networks (id) on delete set null,
  network_code           text not null,
  token_contract         text,
  tx_hash                text,
  from_address           text,
  to_address             text,
  confirmations          integer not null default 0 check (confirmations >= 0),
  required_confirmations integer not null default 0 check (required_confirmations >= 0),
  status                 deposit_status not null default 'PENDING',
  reference_code         text not null,
  verification_payload   jsonb not null default '{}'::jsonb,
  verification_attempts  integer not null default 0,
  last_checked_at        timestamptz,
  rejection_reason       text,
  ledger_entry_id        uuid,
  created_at             timestamptz not null default now(),
  confirmed_at           timestamptz,
  credited_at            timestamptz,
  updated_at             timestamptz not null default now(),

  constraint chk_confirmed_requires_hash
    check (status <> 'CONFIRMED' or (tx_hash is not null and verified_amount is not null))
);

-- A blockchain transaction can NEVER be credited twice.
create unique index if not exists uq_deposit_network_txhash
  on deposits (network_code, lower(tx_hash))
  where tx_hash is not null;

create index if not exists idx_deposits_user on deposits (user_id, created_at desc);
create index if not exists idx_deposits_status on deposits (status, created_at desc);
create index if not exists idx_deposits_reference on deposits (reference_code);

-- ---------------------------------------------------------------------
-- withdrawals
-- ---------------------------------------------------------------------
create table if not exists withdrawals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references profiles (id) on delete cascade,
  amount              numeric(20, 8) not null check (amount > 0),
  fee                 numeric(20, 8) not null default 0 check (fee >= 0),
  net_amount          numeric(20, 8) not null check (net_amount > 0),
  currency            text not null default 'USDT',
  network_id          uuid references supported_networks (id) on delete set null,
  network_code        text not null,
  destination_address text not null,
  status              withdrawal_status not null default 'PENDING',
  tx_hash             text,
  rejection_reason    text,
  admin_note          text,
  processed_by        uuid references profiles (id) on delete set null,
  hold_ledger_id      uuid,
  requested_at        timestamptz not null default now(),
  processed_at        timestamptz,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint chk_paid_requires_hash check (status <> 'PAID' or (tx_hash is not null and paid_at is not null)),
  constraint chk_net_amount check (net_amount = amount - fee)
);

-- At most one open withdrawal per user: prevents double-spend races.
create unique index if not exists uq_withdrawal_one_open_per_user
  on withdrawals (user_id)
  where status in ('PENDING', 'PROCESSING');

create index if not exists idx_withdrawals_user on withdrawals (user_id, created_at desc);
create index if not exists idx_withdrawals_status on withdrawals (status, requested_at desc);
create index if not exists idx_withdrawals_txhash on withdrawals (tx_hash) where tx_hash is not null;

-- ---------------------------------------------------------------------
-- ledger_entries : append only
-- ---------------------------------------------------------------------
create table if not exists ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  seq            bigint generated always as identity,
  user_id        uuid not null references profiles (id) on delete cascade,
  type           ledger_type not null,
  amount         numeric(20, 8) not null check (amount <> 0),
  currency       text not null default 'USDT',
  reference_type text,
  reference_id   uuid,
  balance_before numeric(20, 8) not null check (balance_before >= 0),
  balance_after  numeric(20, 8) not null check (balance_after >= 0),
  description    text,
  created_by     uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_ledger_user on ledger_entries (user_id, created_at desc);
create index if not exists idx_ledger_user_seq on ledger_entries (user_id, seq desc);
create index if not exists idx_ledger_type on ledger_entries (type, created_at desc);
create index if not exists idx_ledger_reference on ledger_entries (reference_type, reference_id);
create index if not exists idx_ledger_created_at on ledger_entries (created_at desc);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  title      text not null,
  message    text not null,
  type       notification_type not null default 'INFO',
  read       boolean not null default false,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications (user_id) where read = false;

-- ---------------------------------------------------------------------
-- admin_actions : audit log
-- ---------------------------------------------------------------------
create table if not exists admin_actions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references profiles (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_actions_admin on admin_actions (admin_id, created_at desc);
create index if not exists idx_admin_actions_target on admin_actions (target_type, target_id);
create index if not exists idx_admin_actions_created on admin_actions (created_at desc);

-- ---------------------------------------------------------------------
-- rate_limits : DB backed so limits hold across serverless instances
-- ---------------------------------------------------------------------
create table if not exists rate_limits (
  bucket_key   text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket_key, window_start)
);

create index if not exists idx_rate_limits_window on rate_limits (window_start);


-- ###########################################################
-- ## 20260101000100_core_functions.sql
-- ###########################################################

-- =====================================================================
-- 20260101000100_core_functions.sql
-- Utility + ledger primitives. Everything money related funnels through
-- app_post_ledger(), which is the ONLY place allowed to touch balances.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so RLS policies on `profiles` can call
-- them without recursing into their own policy.
-- ---------------------------------------------------------------------
create or replace function is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = p_user_id
      and role in ('ADMIN', 'SUPER_ADMIN')
      and status = 'ACTIVE'
  );
$$;

create or replace function is_super_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where id = p_user_id
      and role = 'SUPER_ADMIN'
      and status = 'ACTIVE'
  );
$$;

-- Raises unless the caller is an active admin.
create or replace function assert_admin()
returns uuid
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
  if not is_admin(v_uid) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Raises unless the call comes from the service role key (server only).
create or replace function assert_service_role()
returns void
language plpgsql
stable
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), auth.role()) is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Settings accessors
-- ---------------------------------------------------------------------
create or replace function get_setting(p_key text, p_default jsonb default null)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value from platform_settings where key = p_key), p_default);
$$;

create or replace function get_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb := get_setting(p_key, null);
begin
  if v is null then
    return p_default;
  end if;
  begin
    return (v #>> '{}')::numeric;
  exception when others then
    return p_default;
  end;
end;
$$;

create or replace function get_setting_text(p_key text, p_default text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v jsonb := get_setting(p_key, null);
begin
  if v is null then
    return p_default;
  end if;
  return coalesce(v #>> '{}', p_default);
end;
$$;

-- ---------------------------------------------------------------------
-- Referral code generation (unambiguous alphabet, collision retry)
-- ---------------------------------------------------------------------
create or replace function generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempt integer := 0;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from profiles where referral_code = v_code);

    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'REFERRAL_CODE_GENERATION_FAILED';
    end if;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
create or replace function app_notify(
  p_user_id  uuid,
  p_title    text,
  p_message  text,
  p_type     notification_type default 'INFO',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into notifications (user_id, title, message, type, metadata)
  values (p_user_id, p_title, p_message, p_type, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- app_post_ledger : the single mutation point for balances.
--
-- The direction of a movement is derived from the ledger TYPE, never from
-- the caller, so a caller cannot invent a crediting withdrawal.
--
--   type                  | available delta | pending delta
--   ----------------------+-----------------+---------------
--   DEPOSIT               | +amount         | 0
--   TASK_REWARD           | +amount         | 0
--   REFERRAL_REWARD       | +amount         | 0
--   REFUND                | +amount         | 0
--   VIP_ACTIVATION        | +amount (neg)   | 0
--   ADMIN_ADJUSTMENT      | +amount (±)     | 0
--   WITHDRAWAL_HOLD       | +amount (neg)   | -amount  (moves into pending)
--   WITHDRAWAL_RELEASE    | +amount (pos)   | -amount  (moves back to available)
--   WITHDRAWAL_COMPLETED  | 0               | +amount  (leaves the platform)
-- ---------------------------------------------------------------------
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

  -- Serialise all balance mutations for this user.
  select * into v_profile from profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  case p_type
    when 'DEPOSIT', 'TASK_REWARD', 'REFERRAL_REWARD', 'REFUND' then
      if p_amount <= 0 then
        raise exception 'AMOUNT_MUST_BE_POSITIVE_FOR_%', p_type using errcode = '22023';
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

  update profiles
  set balance_available          = v_new_available,
      balance_pending_withdrawal = v_new_pending,
      total_deposited            = total_deposited + case when p_type = 'DEPOSIT' then p_amount else 0 end,
      total_rewards              = total_rewards
                                     + case when p_type in ('TASK_REWARD', 'REFERRAL_REWARD') then p_amount else 0 end,
      total_withdrawn            = total_withdrawn + case when p_type = 'WITHDRAWAL_COMPLETED' then -p_amount else 0 end,
      updated_at                 = now()
  where id = p_user_id;

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

revoke all on function app_post_ledger(uuid, ledger_type, numeric, text, uuid, text, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window, atomic upsert)
-- ---------------------------------------------------------------------
create or replace function check_rate_limit(
  p_key            text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into rate_limits (bucket_key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limits.count + 1
  returning count into v_count;

  -- Opportunistic cleanup of stale windows.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------
-- Audit logging
-- ---------------------------------------------------------------------
create or replace function log_admin_action(
  p_admin_id    uuid,
  p_action      text,
  p_target_type text,
  p_target_id   uuid,
  p_payload     jsonb default '{}'::jsonb,
  p_ip          text default null,
  p_user_agent  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into admin_actions (admin_id, action, target_type, target_id, payload, ip_address, user_agent)
  values (p_admin_id, p_action, p_target_type, p_target_id, coalesce(p_payload, '{}'::jsonb), p_ip, p_user_agent)
  returning id into v_id;
  return v_id;
end;
$$;


-- ###########################################################
-- ## 20260101000200_triggers.sql
-- ###########################################################

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


-- ###########################################################
-- ## 20260101000300_business_functions.sql
-- ###########################################################

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


-- ###########################################################
-- ## 20260101000400_admin_functions.sql
-- ###########################################################

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


-- ###########################################################
-- ## 20260101000500_rls.sql
-- ###########################################################

-- =====================================================================
-- 20260101000500_rls.sql
-- Row Level Security. Default posture: deny everything, then grant the
-- narrowest possible read. No table accepts direct financial writes from
-- a browser session; all mutations go through SECURITY DEFINER functions.
-- =====================================================================

alter table profiles            enable row level security;
alter table vip_plans           enable row level security;
alter table user_vip_plans      enable row level security;
alter table tasks               enable row level security;
alter table task_assignments    enable row level security;
alter table referrals           enable row level security;
alter table deposits            enable row level security;
alter table withdrawals         enable row level security;
alter table ledger_entries      enable row level security;
alter table notifications       enable row level security;
alter table admin_actions       enable row level security;
alter table platform_settings   enable row level security;
alter table supported_networks  enable row level security;
alter table deposit_addresses   enable row level security;
alter table rate_limits         enable row level security;

-- ---------------------------------------------------------------------
-- Hard revokes: a compromised anon/authenticated JWT still cannot write
-- to the money tables even if a policy were mistakenly added later.
-- ---------------------------------------------------------------------
revoke insert, update, delete on ledger_entries   from anon, authenticated;
revoke insert, update, delete on deposits         from anon, authenticated;
revoke insert, update, delete on withdrawals      from anon, authenticated;
revoke insert, update, delete on task_assignments from anon, authenticated;
revoke insert, update, delete on user_vip_plans   from anon, authenticated;
revoke insert, update, delete on referrals        from anon, authenticated;
revoke insert, update, delete on admin_actions    from anon, authenticated;
revoke all on rate_limits from anon, authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (id = auth.uid() or is_admin(auth.uid()));

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid() or is_admin(auth.uid()))
  with check (id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- vip_plans : catalogue is readable, editable only by admins
-- ---------------------------------------------------------------------
drop policy if exists vip_plans_select on vip_plans;
create policy vip_plans_select on vip_plans
  for select to authenticated, anon
  using (active or is_admin(auth.uid()));

drop policy if exists vip_plans_admin_write on vip_plans;
create policy vip_plans_admin_write on vip_plans
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- user_vip_plans (history)
-- ---------------------------------------------------------------------
drop policy if exists user_vip_plans_select_own on user_vip_plans;
create policy user_vip_plans_select_own on user_vip_plans
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks
  for select to authenticated
  using (active or is_admin(auth.uid()));

drop policy if exists tasks_admin_write on tasks;
create policy tasks_admin_write on tasks
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- task_assignments : read only for the owner; writes via RPC only
-- ---------------------------------------------------------------------
drop policy if exists task_assignments_select_own on task_assignments;
create policy task_assignments_select_own on task_assignments
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------
drop policy if exists referrals_select_own on referrals;
create policy referrals_select_own on referrals
  for select to authenticated
  using (referrer_id = auth.uid() or referred_user_id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- deposits / withdrawals : owner reads, RPC writes
-- ---------------------------------------------------------------------
drop policy if exists deposits_select_own on deposits;
create policy deposits_select_own on deposits
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists withdrawals_select_own on withdrawals;
create policy withdrawals_select_own on withdrawals
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- ledger_entries : read only, forever
-- ---------------------------------------------------------------------
drop policy if exists ledger_select_own on ledger_entries;
create policy ledger_select_own on ledger_entries
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- notifications : owner may read and mark as read
-- ---------------------------------------------------------------------
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke insert, delete on notifications from anon, authenticated;

-- Only the `read` flag may be toggled by a user.
create or replace function guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.title   is distinct from old.title
     or new.message is distinct from old.message
     or new.type    is distinct from old.type
     or new.metadata is distinct from old.metadata
     or new.created_at is distinct from old.created_at then
    raise exception 'ONLY_READ_FLAG_CAN_BE_UPDATED' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_notification_update on notifications;
create trigger trg_guard_notification_update
  before update on notifications
  for each row execute function guard_notification_update();

-- ---------------------------------------------------------------------
-- admin_actions : admins only
-- ---------------------------------------------------------------------
drop policy if exists admin_actions_select on admin_actions;
create policy admin_actions_select on admin_actions
  for select to authenticated
  using (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- platform_settings : only an explicit allow-list is user readable
-- ---------------------------------------------------------------------
drop policy if exists platform_settings_select on platform_settings;
create policy platform_settings_select on platform_settings
  for select to authenticated
  using (
    is_admin(auth.uid())
    or key in (
      'first_withdrawal_wait_days',
      'withdrawal_cooldown_days',
      'first_withdrawal_anchor',
      'default_daily_task_limit',
      'referral_level1_percent',
      'referral_level2_percent',
      'referral_level3_percent',
      'referral_rewards_enabled',
      'platform_name',
      'support_email',
      'vip_upgrade_charge_mode',
      'vip_allow_downgrade'
    )
  );

drop policy if exists platform_settings_admin_write on platform_settings;
create policy platform_settings_admin_write on platform_settings
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- supported_networks / deposit_addresses
-- ---------------------------------------------------------------------
drop policy if exists networks_select on supported_networks;
create policy networks_select on supported_networks
  for select to authenticated
  using (active or is_admin(auth.uid()));

drop policy if exists networks_admin_write on supported_networks;
create policy networks_admin_write on supported_networks
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists deposit_addresses_select on deposit_addresses;
create policy deposit_addresses_select on deposit_addresses
  for select to authenticated
  using (active or is_admin(auth.uid()));

drop policy if exists deposit_addresses_admin_write on deposit_addresses;
create policy deposit_addresses_admin_write on deposit_addresses
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- ---------------------------------------------------------------------
-- Function grants
-- ---------------------------------------------------------------------
grant execute on function ensure_daily_assignments() to authenticated;
grant execute on function start_task(uuid) to authenticated;
grant execute on function claim_task(uuid) to authenticated;
grant execute on function activate_vip(uuid) to authenticated;
grant execute on function create_deposit_intent(numeric, text) to authenticated;
grant execute on function attach_deposit_tx(uuid, text) to authenticated;
grant execute on function request_withdrawal(numeric, text, text) to authenticated;
grant execute on function cancel_withdrawal(uuid) to authenticated;
grant execute on function withdrawal_eligibility(uuid) to authenticated;
grant execute on function get_team_summary(uuid) to authenticated;
grant execute on function get_team_members(uuid, smallint) to authenticated;
grant execute on function compute_task_reward(uuid, uuid) to authenticated;

grant execute on function admin_dashboard_stats() to authenticated;
grant execute on function admin_start_withdrawal_processing(uuid) to authenticated;
grant execute on function admin_mark_withdrawal_paid(uuid, text, text) to authenticated;
grant execute on function admin_reject_withdrawal(uuid, text) to authenticated;
grant execute on function admin_confirm_deposit(uuid, numeric, text, text) to authenticated;
grant execute on function admin_reject_deposit(uuid, text) to authenticated;
grant execute on function admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function admin_set_user_status(uuid, user_status, text) to authenticated;
grant execute on function admin_set_user_role(uuid, user_role) to authenticated;
grant execute on function admin_set_setting(text, jsonb, text) to authenticated;

-- Server-only surface.
revoke execute on function credit_verified_deposit(uuid, numeric, text, text, text, integer, jsonb) from anon, authenticated;
revoke execute on function record_deposit_check(uuid, integer, jsonb, text) from anon, authenticated;
revoke execute on function check_rate_limit(text, integer, integer) from anon, authenticated;
revoke execute on function app_notify(uuid, text, text, notification_type, jsonb) from anon, authenticated;
revoke execute on function log_admin_action(uuid, text, text, uuid, jsonb, text, text) from anon, authenticated;
revoke execute on function pay_referral_commission(uuid, numeric, text, uuid) from anon, authenticated;
revoke execute on function generate_referral_code() from anon, authenticated;

-- ---------------------------------------------------------------------
-- Public read model for the invitation form: lets the registration page
-- confirm that a code exists WITHOUT exposing any profile data.
-- ---------------------------------------------------------------------
create or replace function is_valid_invitation_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from profiles
    where referral_code = upper(trim(p_code))
      and status = 'ACTIVE'
  );
$$;

grant execute on function is_valid_invitation_code(text) to anon, authenticated;


-- ###########################################################
-- ## 20260101000600_bootstrap_invitation.sql
-- ###########################################################

-- =====================================================================
-- 20260101000600_bootstrap_invitation.sql
--
-- Aligns the invitation-code read model with the provisioning trigger.
--
-- `handle_new_user()` treats the very first account on a fresh install as
-- the owner and lets it through without an inviter, because there is
-- nobody who could have invited it. `is_valid_invitation_code()` did not
-- know about that rule, so `registerAction` rejected every code on an
-- empty database and the owner account could never be created through the
-- UI at all.
--
-- The two now agree: on an empty database any syntactically valid code is
-- accepted (the trigger ignores it and provisions the SUPER_ADMIN owner);
-- from the second account onwards a real, active inviter is required.
-- =====================================================================

create or replace function is_valid_invitation_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (select 1 from profiles) then true
    else exists (
      select 1 from profiles
      where referral_code = upper(trim(p_code))
        and status = 'ACTIVE'
    )
  end;
$$;

grant execute on function is_valid_invitation_code(text) to anon, authenticated;


-- ###########################################################
-- ## 20260101000700_task_images.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Task images
--
-- Adds an illustration to each verification task. The column holds a URL,
-- which may point either at the Supabase Storage bucket created below or
-- at any external image the operator prefers.
--
-- The image is decoration for the member's benefit. Nothing in the reward
-- calculation, the timer or the claim path reads it.
-- ---------------------------------------------------------------------

alter table tasks
  add column if not exists image_url text;

comment on column tasks.image_url is
  'Optional illustration shown on the task card. Decorative only: no business rule reads it.';

-- Reject anything that is not an absolute https URL or a site-relative path.
-- This keeps `javascript:` and `data:` out of an <img src> even if the admin
-- form were bypassed.
--
-- Written with LIKE and length() rather than a bounded regex repetition:
-- PostgreSQL caps a repetition count at 255, and a larger bound only fails
-- when the expression is first evaluated, not when it is created. Migration
-- 20260101000900 repairs databases where the earlier version was applied.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_tasks_image_url'
  ) then
    alter table tasks
      add constraint chk_tasks_image_url check (
        image_url is null
        or (
          length(image_url) between 4 and 2000
          and (image_url like 'https://%' or image_url like '/%')
          and image_url ~ '^[^[:space:]]+$'
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage bucket
--
-- Public read so an <img> tag needs no signed URL; writes are restricted
-- to admins by the policies below. The whole block is tolerant: on a
-- Postgres role without rights over the storage schema it emits a notice
-- instead of failing the migration, and the URL field still works.
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'task-images',
    'task-images',
    true,
    2097152,                                            -- 2 MB
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  )
  on conflict (id) do update
    set public             = excluded.public,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Anyone may read: the bucket is public and holds nothing sensitive.
  drop policy if exists task_images_read on storage.objects;
  create policy task_images_read on storage.objects
    for select to public
    using (bucket_id = 'task-images');

  -- Only admins may add, replace or delete an illustration.
  drop policy if exists task_images_insert on storage.objects;
  create policy task_images_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'task-images' and is_admin(auth.uid()));

  drop policy if exists task_images_update on storage.objects;
  create policy task_images_update on storage.objects
    for update to authenticated
    using (bucket_id = 'task-images' and is_admin(auth.uid()))
    with check (bucket_id = 'task-images' and is_admin(auth.uid()));

  drop policy if exists task_images_delete on storage.objects;
  create policy task_images_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'task-images' and is_admin(auth.uid()));

exception
  when insufficient_privilege or undefined_table then
    raise notice
      'Storage bucket task-images was not configured (%). Create it in the Supabase dashboard, or keep using external image URLs.',
      sqlerrm;
end $$;


-- ###########################################################
-- ## 20260101000800_task_images_reload.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Task images — safety net and PostgREST cache reload
--
-- After a column is added, PostgREST keeps serving its cached schema and
-- rejects writes to the new column with:
--
--   PGRST204  Could not find the 'image_url' column of 'tasks'
--             in the schema cache
--
-- which looks exactly like a broken feature. The NOTIFY below tells
-- PostgREST to reload immediately.
--
-- The ALTER is repeated defensively: it is a no-op when 000700 already
-- ran, and it repairs the column if that migration was skipped or only
-- partly applied. Both statements are safe to run any number of times.
-- ---------------------------------------------------------------------

alter table tasks
  add column if not exists image_url text;

notify pgrst, 'reload schema';


-- ###########################################################
-- ## 20260101000900_fix_task_image_check.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Fix chk_tasks_image_url
--
-- Migration 000700 wrote the constraint as
--
--   image_url ~ '^https://[^\s]{3,2000}$'
--
-- PostgreSQL's regex engine caps a bounded repetition at 255, so {3,2000}
-- is rejected — but only when the expression is actually evaluated. The
-- constraint therefore created cleanly and stayed silent while image_url
-- was null (the `is null` branch short-circuits), then failed the first
-- time a URL was written:
--
--   2201B  invalid regular expression: invalid repetition count(s)
--
-- Rewritten with LIKE for the prefix, length() for the bound, and an
-- unbounded character class for the whitespace rule. Same intent, no
-- repetition count: an https:// address or a site-relative path, at most
-- 2000 characters, containing no whitespace — so `javascript:` and `data:`
-- can never reach an <img src>.
-- ---------------------------------------------------------------------

alter table tasks
  drop constraint if exists chk_tasks_image_url;

alter table tasks
  add constraint chk_tasks_image_url check (
    image_url is null
    or (
      length(image_url) between 4 and 2000
      and (image_url like 'https://%' or image_url like '/%')
      and image_url ~ '^[^[:space:]]+$'
    )
  );

notify pgrst, 'reload schema';


-- ###########################################################
-- ## 20260101001000_single_pending_deposit.sql
-- ###########################################################

-- Allow users to keep at most one deposit verification open at a time.
-- A pending deposit blocks a new intent until it is confirmed or cancelled.

alter type deposit_status add value if not exists 'CANCELLED';

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
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  -- Serialize intent creation per user so concurrent requests cannot both pass
  -- the pending-deposit check.
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

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
  where user_id = v_uid and status = 'PENDING';

  if v_open > 0 then
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

create or replace function cancel_deposit_intent(p_deposit_id uuid)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_deposit deposits%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_deposit
  from deposits
  where id = p_deposit_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_deposit.tx_hash is not null then
    raise exception 'DEPOSIT_TX_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  update deposits
  set status = 'CANCELLED'::deposit_status,
      updated_at = now()
  where id = p_deposit_id
  returning * into v_deposit;

  return v_deposit;
end;
$$;

grant execute on function cancel_deposit_intent(uuid) to authenticated;


-- ###########################################################
-- ## 20260101001100_admin_delete_user.sql
-- ###########################################################

-- Permanently delete an account and its auth/profile-linked data.
-- The auth.users foreign key cascades to the public profile and user-owned rows.

create or replace function admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_target_role user_role;
  v_target_email text;
begin
  if p_user_id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_user_id = v_admin then
    raise exception 'CANNOT_DELETE_OWN_ACCOUNT' using errcode = '42501';
  end if;

  select role, email into v_target_role, v_target_email
  from profiles
  where id = p_user_id;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target_role = 'SUPER_ADMIN' and not is_super_admin(v_admin) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  perform log_admin_action(
    v_admin,
    'user.deleted_permanently',
    'profile',
    p_user_id,
    jsonb_build_object('email', v_target_email, 'role', v_target_role),
    null,
    null
  );

  -- auth.users owns the profile row; ON DELETE CASCADE removes dependent data.
  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function admin_delete_user(uuid) to authenticated;


-- ###########################################################
-- ## 20260929000000_crypto_market_analysis_copy.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Crypto market-analysis task copy
--
-- Content-only transition from the original property-listing exercise
-- pool. Task IDs and assignments stay intact; timing, rewards and all
-- business functions remain unchanged.
-- ---------------------------------------------------------------------

update platform_settings
set value = '"ArbiFlow"'::jsonb
where key = 'platform_name'
  and value = '"PropVerify"'::jsonb;

update vip_plans
set description = regexp_replace(
  description,
  'property verification tasks',
  'crypto market-analysis exercises',
  'gi'
)
where description ilike '%property verification tasks%';

update tasks as task
set title = copy.title,
    description = copy.description,
    task_type = copy.new_type,
    image_url = null
from (values
  (
    'PHOTO_VERIFICATION',
    'MARKET_SPREAD_REVIEW',
    'Market Spread Snapshot',
    'Compare the displayed price for the same crypto asset across two market scenarios and estimate the raw spread before fees. This exercise does not place a trade.'
  ),
  (
    'LOCATION_VERIFICATION',
    'NETWORK_FEE_CHECK',
    'Network Fee Impact',
    'Review the network and trading fees shown in the scenario, then note whether they would reduce or erase the apparent spread. No transaction is submitted.'
  ),
  (
    'INFO_VERIFICATION',
    'LIQUIDITY_DEPTH_REVIEW',
    'Liquidity Depth Review',
    'Inspect the displayed order-book depth for the asset pair and identify whether limited liquidity or slippage could change the quoted spread.'
  ),
  (
    'AMENITIES_VERIFICATION',
    'VOLATILITY_WINDOW_SCAN',
    'Volatility Window Scan',
    'Compare the timestamps and price movement in the scenario, then flag volatility or stale quotes that could make a spread unreliable.'
  ),
  (
    'DESCRIPTION_REVIEW',
    'PAIR_PRICE_ALIGNMENT',
    'Cross-Market Pair Alignment',
    'Compare the same crypto pair across the displayed venues and flag mismatched quotes, symbols or timestamps before estimating any spread.'
  ),
  (
    'PRICE_COMPARISON',
    'STABLECOIN_SPREAD_REVIEW',
    'Stablecoin Spread Monitor',
    'Review the displayed stablecoin quotes across market scenarios and note whether the difference remains after the stated fees and slippage.'
  ),
  (
    'QUALITY_CHECK',
    'ARBITRAGE_RISK_SCORE',
    'Arbitrage Scenario Risk Score',
    'Assess a hypothetical spread using fees, liquidity, slippage, volatility and settlement timing. Record the key risks; this is analysis only, not a trade recommendation.'
  )
) as copy(old_type, new_type, title, description)
where task.task_type = copy.old_type;


-- ###########################################################
-- ## 20261001000000_admin_user_referral_controls.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Admin user CRUD and VIP referral-programme eligibility.
-- Existing VIP plans stay referral-eligible by default, preserving the
-- current commission behavior until an operator explicitly removes one.
-- ---------------------------------------------------------------------

alter table vip_plans
  add column if not exists referral_enabled boolean not null default true;

create or replace function admin_update_user_username(p_user_id uuid, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_target profiles%rowtype;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_.-]{3,24}$' then
    raise exception 'INVALID_USERNAME' using errcode = '22023';
  end if;

  select * into v_target from profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target.role in ('ADMIN', 'SUPER_ADMIN') and not is_super_admin(v_admin) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  update profiles set username = p_username, updated_at = now() where id = p_user_id;

  perform log_admin_action(
    v_admin,
    'user.username_updated',
    'profile',
    p_user_id,
    jsonb_build_object('from', v_target.username, 'to', p_username)
  );

  return jsonb_build_object('user_id', p_user_id, 'username', p_username);
end;
$$;

grant execute on function admin_update_user_username(uuid, text) to authenticated;

create or replace function admin_log_user_invited(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_target profiles%rowtype;
begin
  select * into v_target from profiles where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform log_admin_action(
    v_admin,
    'user.invited',
    'profile',
    p_user_id,
    jsonb_build_object('email', v_target.email, 'username', v_target.username, 'referred_by', v_target.referred_by)
  );
end;
$$;

grant execute on function admin_log_user_invited(uuid) to authenticated;

create or replace function admin_set_vip_referral_enabled(p_plan_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_plan vip_plans%rowtype;
begin
  if p_enabled is null then
    raise exception 'INVALID_REFERRAL_SETTING' using errcode = '22023';
  end if;

  select * into v_plan from vip_plans where id = p_plan_id for update;
  if not found then
    raise exception 'VIP_PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  update vip_plans set referral_enabled = p_enabled, updated_at = now() where id = p_plan_id;

  perform log_admin_action(
    v_admin,
    'vip_plan.referral_eligibility_changed',
    'vip_plan',
    p_plan_id,
    jsonb_build_object('plan', v_plan.name, 'from', v_plan.referral_enabled, 'to', p_enabled)
  );

  return jsonb_build_object('plan_id', p_plan_id, 'referral_enabled', p_enabled);
end;
$$;

grant execute on function admin_set_vip_referral_enabled(uuid, boolean) to authenticated;

-- Commission still uses the existing global enable switch and three rates,
-- but only plans included in the operator's referral programme can trigger it.
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
  v_rec              record;
  v_percent          numeric;
  v_amount           numeric(20, 8);
  v_plan_is_included boolean;
  v_enabled          boolean := get_setting_text('referral_rewards_enabled', 'true') = 'true';
begin
  if not v_enabled or p_source_amount is null or p_source_amount <= 0 then
    return;
  end if;

  if p_reference_type = 'vip_activation' then
    select vp.referral_enabled into v_plan_is_included
    from user_vip_plans history
    join vip_plans vp on vp.id = history.new_plan_id
    where history.id = p_reference_id
      and history.user_id = p_user_id;

    if not coalesce(v_plan_is_included, false) then
      return;
    end if;
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


-- ###########################################################
-- ## 20261008000000_manual_deposit_proofs.sql
-- ###########################################################

-- ---------------------------------------------------------------------
-- Manual deposit proof workflow
-- ---------------------------------------------------------------------

alter table deposits
  add column if not exists payment_proof_path text,
  add column if not exists proof_ocr_data jsonb;

alter table deposits
  drop constraint if exists chk_confirmed_requires_hash;

alter table deposits
  add constraint chk_confirmed_requires_hash check (
    status <> 'CONFIRMED'
    or (
      verified_amount is not null
      and (
        tx_hash is not null
        or (
          payment_proof_path is not null
          and verification_payload ->> 'manual_review_kind' = 'payment_proof'
        )
      )
    )
  );

comment on column deposits.payment_proof_path is
  'Private Supabase Storage path for a user-submitted payment screenshot. Never treated as verified payment.';
comment on column deposits.proof_ocr_data is
  'Untrusted browser OCR output retained for admin review; never used to determine the credited amount.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deposit-proofs',
  'deposit-proofs',
  false,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists deposit_proofs_admin_read on storage.objects;
create policy deposit_proofs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'deposit-proofs' and public.is_admin(auth.uid()));

create or replace function attach_deposit_proof(
  p_deposit_id uuid,
  p_proof_path text,
  p_ocr_data   jsonb
)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_deposit deposits%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_ocr_data is null or jsonb_typeof(p_ocr_data) <> 'object' then
    raise exception 'INVALID_PAYMENT_PROOF' using errcode = '22023';
  end if;
  if p_proof_path is null or p_proof_path !~ (
    '^' || v_uid::text || '/' || p_deposit_id::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'
  ) then
    raise exception 'INVALID_PAYMENT_PROOF_PATH' using errcode = '22023';
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
  if v_deposit.payment_proof_path is not null then
    raise exception 'DEPOSIT_PROOF_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  update deposits
  set payment_proof_path = p_proof_path,
      proof_ocr_data = p_ocr_data,
      updated_at = now()
  where id = p_deposit_id
  returning * into v_deposit;

  return v_deposit;
end;
$$;

revoke all on function attach_deposit_proof(uuid, text, jsonb) from public, anon;
grant execute on function attach_deposit_proof(uuid, text, jsonb) to authenticated;

create or replace function admin_approve_deposit_proof(
  p_deposit_id uuid,
  p_amount     numeric,
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
  v_amount  numeric(20, 8);
begin
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 8) then
    raise exception 'INVALID_AMOUNT' using errcode = '22023';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_deposit.payment_proof_path is null then
    raise exception 'DEPOSIT_PROOF_REQUIRED' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'deposit-proofs'
      and name = v_deposit.payment_proof_path
  ) then
    raise exception 'DEPOSIT_PROOF_REQUIRED' using errcode = 'P0001';
  end if;

  v_amount := round(p_amount, 8);

  update deposits
  set status = 'CONFIRMED',
      verified_amount = v_amount,
      confirmed_at = now(),
      credited_at = now(),
      updated_at = now(),
      verification_payload = coalesce(verification_payload, '{}'::jsonb)
        || jsonb_build_object(
          'manual_review', true,
          'manual_review_kind', 'payment_proof',
          'admin_id', v_admin,
          'reason', trim(p_reason)
        )
  where id = p_deposit_id
  returning * into v_deposit;

  v_entry := app_post_ledger(
    v_deposit.user_id,
    'DEPOSIT',
    v_amount,
    'deposit',
    v_deposit.id,
    format('Deposit approved from payment proof (%s)', v_deposit.reference_code),
    v_admin,
    v_deposit.currency
  );

  update deposits
  set ledger_entry_id = v_entry.id
  where id = p_deposit_id;

  perform log_admin_action(
    v_admin,
    'deposit.proof_approved',
    'deposit',
    p_deposit_id,
    jsonb_build_object('amount', v_amount, 'reason', trim(p_reason), 'proof_path', v_deposit.payment_proof_path)
  );

  perform app_notify(
    v_deposit.user_id,
    'Deposit confirmed',
    format(
      'Your deposit of %s %s has been reviewed and credited to your internal platform balance.',
      to_char(v_amount, 'FM999999990.00'),
      v_deposit.currency
    ),
    'SUCCESS',
    jsonb_build_object('event', 'deposit_confirmed', 'deposit_id', p_deposit_id)
  );

  return jsonb_build_object(
    'deposit_id', p_deposit_id,
    'status', 'CONFIRMED',
    'credited_amount', v_amount,
    'balance_after', v_entry.balance_after
  );
end;
$$;

revoke all on function admin_approve_deposit_proof(uuid, numeric, text) from public, anon;
grant execute on function admin_approve_deposit_proof(uuid, numeric, text) to authenticated;

create or replace function cancel_deposit_intent(p_deposit_id uuid)
returns deposits
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_deposit deposits%rowtype;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_deposit
  from deposits
  where id = p_deposit_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_deposit.status <> 'PENDING' then
    raise exception 'DEPOSIT_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_deposit.tx_hash is not null then
    raise exception 'DEPOSIT_TX_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;
  if v_deposit.payment_proof_path is not null then
    raise exception 'DEPOSIT_PROOF_ALREADY_SUBMITTED' using errcode = 'P0001';
  end if;

  update deposits
  set status = 'CANCELLED'::deposit_status,
      updated_at = now()
  where id = p_deposit_id
  returning * into v_deposit;

  return v_deposit;
end;
$$;


-- ###########################################################
-- ## 20261008200000_vip_withdrawal_fees.sql
-- ###########################################################

alter table vip_plans
  add column if not exists withdrawal_fee numeric(20, 8) not null default 0
    check (withdrawal_fee >= 0);

update vip_plans
set withdrawal_fee = 0
where level > 7 and withdrawal_fee <> 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vip_plans'::regclass
      and conname = 'vip_plans_level_over_seven_free_fee'
  ) then
    alter table vip_plans
      add constraint vip_plans_level_over_seven_free_fee
      check (level <= 7 or withdrawal_fee = 0);
  end if;
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
  v_vip_plan    vip_plans%rowtype;
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

  if v_profile.current_vip_plan_id is not null then
    select * into v_vip_plan
    from vip_plans
    where id = v_profile.current_vip_plan_id;
  end if;

  v_fee := round(
    v_network.withdrawal_fee
    + case when v_vip_plan.level between 1 and 7 then v_vip_plan.withdrawal_fee else 0 end,
    8
  );
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


-- ###########################################################
-- ## 20261009120000_withdrawal_task_lock.sql
-- ###########################################################

insert into platform_settings (key, value, description)
values (
  'withdrawal_task_lock_hours',
  '48'::jsonb,
  'Hours to pause task activity after a withdrawal request. Set to 0 to disable.'
)
on conflict (key) do nothing;

create or replace function user_task_lock_until(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours numeric := get_setting_numeric('withdrawal_task_lock_hours', 48);
  v_last_request timestamptz;
begin
  if v_hours < 0 or v_hours > 720 or v_hours <> trunc(v_hours) then
    raise exception 'INVALID_WITHDRAWAL_TASK_LOCK_HOURS' using errcode = '22023';
  end if;

  if v_hours = 0 then
    return null;
  end if;

  select max(requested_at)
    into v_last_request
  from withdrawals
  where user_id = p_user_id;

  if v_last_request is null then
    return null;
  end if;

  return v_last_request + make_interval(hours => v_hours::integer);
end;
$$;

revoke all on function user_task_lock_until(uuid) from public, anon, authenticated;

create or replace function current_user_task_lock_status()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hours numeric := get_setting_numeric('withdrawal_task_lock_hours', 48);
  v_locked_until timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  v_locked_until := user_task_lock_until(v_uid);

  return jsonb_build_object(
    'locked', v_locked_until is not null and now() < v_locked_until,
    'locked_until', v_locked_until,
    'duration_hours', v_hours
  );
end;
$$;

revoke all on function current_user_task_lock_status() from public, anon;
grant execute on function current_user_task_lock_status() to authenticated;

create or replace function guard_task_assignment_during_withdrawal_lock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locked_until timestamptz;
begin
  perform 1
  from profiles
  where id = new.user_id
  for update;

  if tg_op = 'INSERT' then
    if new.status in ('AVAILABLE', 'STARTED', 'COMPLETED') then
      v_locked_until := user_task_lock_until(new.user_id);
      if v_locked_until is not null and now() < v_locked_until then
        return null;
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status in ('STARTED', 'COMPLETED') and new.status is distinct from old.status then
      v_locked_until := user_task_lock_until(new.user_id);
      if v_locked_until is not null and now() < v_locked_until then
        raise exception 'TASKS_LOCKED_AFTER_WITHDRAWAL:%', v_locked_until
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function guard_task_assignment_during_withdrawal_lock() from public, anon, authenticated;

drop trigger if exists trg_task_assignment_withdrawal_lock on task_assignments;
create trigger trg_task_assignment_withdrawal_lock
  before insert or update on task_assignments
  for each row execute function guard_task_assignment_during_withdrawal_lock();


-- ###########################################################
-- ## 20261009140000_optional_withdrawal_tx_hash.sql
-- ###########################################################

alter table withdrawals
  drop constraint if exists chk_paid_requires_hash;

alter table withdrawals
  add constraint chk_paid_requires_paid_at
  check (status <> 'PAID' or paid_at is not null);

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
  v_hash       text := nullif(trim(p_tx_hash), '');
  v_note       text := nullif(trim(p_note), '');
begin
  if v_hash is not null and length(v_hash) < 10 then
    raise exception 'INVALID_TX_HASH' using errcode = '22023';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'WITHDRAWAL_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_withdrawal.status not in ('PENDING', 'PROCESSING') then
    raise exception 'INVALID_WITHDRAWAL_STATE' using errcode = 'P0001';
  end if;

  if v_hash is not null and exists (
    select 1 from withdrawals where lower(tx_hash) = lower(v_hash) and id <> p_withdrawal_id
  ) then
    raise exception 'TX_HASH_ALREADY_USED' using errcode = 'P0001';
  end if;

  update withdrawals
  set status       = 'PAID',
      tx_hash      = v_hash,
      admin_note   = coalesce(v_note, admin_note),
      processed_by = v_admin,
      processed_at = coalesce(processed_at, now()),
      paid_at      = now(),
      updated_at   = now()
  where id = p_withdrawal_id;

  perform app_post_ledger(
    v_withdrawal.user_id,
    'WITHDRAWAL_COMPLETED',
    -v_withdrawal.amount,
    'withdrawal',
    v_withdrawal.id,
    case
      when v_hash is null then 'Withdrawal paid, no transaction hash provided'
      else format('Withdrawal paid, tx %s', v_hash)
    end,
    v_admin,
    v_withdrawal.currency
  );

  update profiles
  set last_withdrawal_at = now(), updated_at = now()
  where id = v_withdrawal.user_id;

  perform log_admin_action(
    v_admin,
    'withdrawal.paid',
    'withdrawal',
    p_withdrawal_id,
    jsonb_build_object('amount', v_withdrawal.amount, 'tx_hash', v_hash, 'note', v_note)
  );

  perform app_notify(
    v_withdrawal.user_id,
    'Withdrawal paid',
    case
      when v_hash is null then
        format('Your withdrawal of %s %s has been paid.',
               to_char(v_withdrawal.net_amount, 'FM999999990.00'), v_withdrawal.currency)
      else
        format('Your withdrawal of %s %s has been paid. Transaction hash: %s',
               to_char(v_withdrawal.net_amount, 'FM999999990.00'), v_withdrawal.currency, v_hash)
    end,
    'SUCCESS',
    jsonb_build_object('event', 'withdrawal_paid', 'withdrawal_id', p_withdrawal_id, 'tx_hash', v_hash)
  );

  return jsonb_build_object('withdrawal_id', p_withdrawal_id, 'status', 'PAID', 'tx_hash', v_hash);
end;
$$;


-- ###########################################################
-- ## seed.sql
-- ###########################################################

-- =====================================================================
-- seed.sql
-- Baseline configuration. Everything here is editable from /admin later.
--
-- NOTE: no deposit address is seeded on purpose. Deposit addresses are
-- real wallets that only the operator can supply, and inventing one would
-- send user funds into the void. Add yours under /admin/settings before
-- enabling deposits.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Platform settings
-- ---------------------------------------------------------------------
insert into platform_settings (key, value, description) values
  ('platform_name',              '"ArbiFlow"'::jsonb,          'Display name of the platform'),
  ('support_email',              '"support@example.com"'::jsonb, 'Support contact address'),

  ('first_withdrawal_wait_days', '30'::jsonb,                  'Days a user must wait before the first withdrawal'),
  ('withdrawal_cooldown_days',   '10'::jsonb,                  'Days between withdrawals after the first paid one'),
  ('first_withdrawal_anchor',    '"VIP_ACTIVATION"'::jsonb,    'VIP_ACTIVATION or REGISTRATION: what starts the waiting period'),

  ('default_daily_task_limit',   '3'::jsonb,                   'Daily task allowance for users without an active VIP plan'),

  ('referral_rewards_enabled',   '"true"'::jsonb,              'Master switch for referral commissions'),
  ('referral_level1_percent',    '0.08'::jsonb,                'Level 1 commission on collected VIP activation revenue'),
  ('referral_level2_percent',    '0.03'::jsonb,                'Level 2 commission on collected VIP activation revenue'),
  ('referral_level3_percent',    '0.01'::jsonb,                'Level 3 commission on collected VIP activation revenue'),

  ('vip_upgrade_charge_mode',    '"FULL"'::jsonb,              'FULL charges the whole activation amount, DIFFERENCE charges only the delta'),
  ('vip_allow_downgrade',        '"false"'::jsonb,             'Whether users may move to a lower VIP level'),

  ('max_open_deposit_intents',   '5'::jsonb,                   'Maximum simultaneous unsubmitted deposit intents per user')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- VIP plans
--
-- reward_rate is a CONFIGURABLE TASK REWARD PARAMETER: the fraction of the
-- activation amount that funds one day's task reward pool, split across
-- that plan's daily tasks. It is an operating budget the platform chooses
-- to pay for completed market-analysis exercises. It is not interest, not a yield,
-- and not a guaranteed return of any kind.
-- ---------------------------------------------------------------------
insert into vip_plans (name, level, activation_amount, daily_task_limit, reward_rate, description, sort_order) values
  ('VIP 1', 1,  60.00, 3, 0.00800000, 'Entry tier. 3 crypto market-analysis exercises per day.',        1),
  ('VIP 2', 2, 100.00, 3, 0.00900000, 'Standard tier. 3 crypto market-analysis exercises per day.',     2),
  ('VIP 3', 3, 150.00, 3, 0.01000000, 'Advanced tier. 3 crypto market-analysis exercises per day.',     3),
  ('VIP 4', 4, 300.00, 3, 0.01100000, 'Professional tier. 3 crypto market-analysis exercises per day.', 4),
  ('VIP 5', 5, 500.00, 3, 0.01200000, 'Expert tier. 3 crypto market-analysis exercises per day.',       5)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------
insert into tasks (title, description, task_type, duration_seconds, difficulty, sort_order) values
  ('Market Spread Snapshot',
   'Compare the displayed price for the same crypto asset across two market scenarios and estimate the raw spread before fees. This exercise does not place a trade.',
   'MARKET_SPREAD_REVIEW', 180, 'EASY', 1),

  ('Network Fee Impact',
   'Review the network and trading fees shown in the scenario, then note whether they would reduce or erase the apparent spread. No transaction is submitted.',
   'NETWORK_FEE_CHECK', 180, 'EASY', 2),

  ('Liquidity Depth Review',
   'Inspect the displayed order-book depth for the asset pair and identify whether limited liquidity or slippage could change the quoted spread.',
   'LIQUIDITY_DEPTH_REVIEW', 180, 'EASY', 3),

  ('Volatility Window Scan',
   'Compare the timestamps and price movement in the scenario, then flag volatility or stale quotes that could make a spread unreliable.',
   'VOLATILITY_WINDOW_SCAN', 180, 'MEDIUM', 4),

  ('Cross-Market Pair Alignment',
   'Compare the same crypto pair across the displayed venues and flag mismatched quotes, symbols or timestamps before estimating any spread.',
   'PAIR_PRICE_ALIGNMENT', 180, 'MEDIUM', 5),

  ('Stablecoin Spread Monitor',
   'Review the displayed stablecoin quotes across market scenarios and note whether the difference remains after the stated fees and slippage.',
   'STABLECOIN_SPREAD_REVIEW', 180, 'MEDIUM', 6),

  ('Arbitrage Scenario Risk Score',
   'Assess a hypothetical spread using fees, liquidity, slippage, volatility and settlement timing. Record the key risks; this is analysis only, not a trade recommendation.',
   'ARBITRAGE_RISK_SCORE', 180, 'HARD', 7)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Supported networks
--
-- token_contract values below are the public USDT token contracts on each
-- chain. They are used to reject deposits made with the wrong token.
-- ---------------------------------------------------------------------
insert into supported_networks (
  code, name, chain, token_symbol, token_contract, token_decimals,
  required_confirmations, address_regex, explorer_tx_url,
  min_deposit, min_withdrawal, withdrawal_fee, sort_order
) values
  ('TRC20', 'Tron (TRC20)', 'tron', 'USDT',
   'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 6, 19,
   '^T[1-9A-HJ-NP-Za-km-z]{33}$', 'https://tronscan.org/#/transaction/{hash}',
   1, 10, 1, 1),

  ('BEP20', 'BNB Smart Chain (BEP20)', 'bsc', 'USDT',
   '0x55d398326f99059fF775485246999027B3197955', 18, 15,
   '^0x[a-fA-F0-9]{40}$', 'https://bscscan.com/tx/{hash}',
   1, 10, 0.5, 2),

  ('ERC20', 'Ethereum (ERC20)', 'ethereum', 'USDT',
   '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 12,
   '^0x[a-fA-F0-9]{40}$', 'https://etherscan.io/tx/{hash}',
   10, 50, 5, 3)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Deposit addresses: intentionally empty.
--
-- Add your real receiving wallets, for example:
--
--   insert into deposit_addresses (network_id, address, label)
--   select id, 'T....your.real.tron.address....', 'Main TRC20 hot wallet'
--   from supported_networks where code = 'TRC20';
--
-- Until at least one active address exists for a network, create_deposit_intent()
-- refuses to issue deposit instructions for it.
-- ---------------------------------------------------------------------

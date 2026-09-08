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

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

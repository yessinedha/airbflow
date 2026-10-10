create or replace function business_days_remaining(p_from timestamptz, p_until timestamptz)
returns integer
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_from_date date := (p_from at time zone 'UTC')::date;
  v_until_date date := (p_until at time zone 'UTC')::date;
begin
  if p_until <= p_from then
    return 0;
  end if;

  return (
    select count(*)::integer
    from generate_series(
      case when v_from_date = v_until_date then v_from_date else v_from_date + 1 end,
      v_until_date,
      interval '1 day'
    ) as calendar_day(day)
    where extract(isodow from calendar_day.day) between 1 and 5
  );
end;
$$;

revoke all on function business_days_remaining(timestamptz, timestamptz) from public, anon, authenticated;

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
  v_cooldown_from timestamptz;
  v_eligible_utc timestamp without time zone;
  v_has_paid     boolean;
  v_open         integer;
  v_eligible_at  timestamptz;
  v_reason       text := null;
  v_day          integer := 0;
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
    v_cooldown_from := coalesce(v_profile.last_withdrawal_at, v_anchor);
    if v_cooldown_from is null then
      v_eligible_at := null;
      v_reason := 'NO_ACTIVATION';
    else
      v_eligible_utc := v_cooldown_from at time zone 'UTC';
      while v_day < v_cooldown loop
        v_eligible_utc := v_eligible_utc + interval '1 day';
        if extract(isodow from v_eligible_utc) between 1 and 5 then
          v_day := v_day + 1;
        end if;
      end loop;
      v_eligible_at := v_eligible_utc at time zone 'UTC';
    end if;
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
                             when v_has_paid then business_days_remaining(now(), v_eligible_at)
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

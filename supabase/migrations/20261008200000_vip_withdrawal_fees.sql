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

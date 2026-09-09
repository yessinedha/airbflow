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

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

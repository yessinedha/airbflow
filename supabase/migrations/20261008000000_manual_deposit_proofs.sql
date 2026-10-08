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

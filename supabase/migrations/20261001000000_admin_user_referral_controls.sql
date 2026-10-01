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

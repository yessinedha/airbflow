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

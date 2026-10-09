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

-- Daily operator presence switch. Missing the 17:00 Africa/Tunis check-in
-- closes public routes after a 15-minute grace period and remains closed
-- until an administrator confirms presence again.

create table if not exists site_presence_switch (
  singleton    boolean primary key default true check (singleton),
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  is_closed    boolean not null default false,
  closed_at    timestamptz,
  updated_at   timestamptz not null default now()
);

insert into site_presence_switch (singleton)
values (true)
on conflict (singleton) do nothing;

alter table site_presence_switch enable row level security;
revoke all on site_presence_switch from anon, authenticated;
grant select on site_presence_switch to authenticated;

drop policy if exists site_presence_switch_admin_select on site_presence_switch;
create policy site_presence_switch_admin_select on site_presence_switch
  for select to authenticated
  using (is_admin(auth.uid()));

create or replace function check_site_presence_switch()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tunis_now timestamp without time zone := timezone('Africa/Tunis', now());
  v_is_closed boolean;
begin
  update site_presence_switch
  set is_closed = true,
      closed_at = now(),
      updated_at = now()
  where singleton = true
    and is_closed = false
    and v_tunis_now >= (
      (
        coalesce(
          confirmed_at at time zone 'Africa/Tunis',
          created_at at time zone 'Africa/Tunis'
        )::date + time '17:15'
      )
      + case
          when coalesce(
            confirmed_at at time zone 'Africa/Tunis',
            created_at at time zone 'Africa/Tunis'
          )::time >= time '17:15'
            then interval '1 day'
          else interval '0'
        end
    );

  select is_closed into v_is_closed
  from site_presence_switch
  where singleton = true;

  return coalesce(v_is_closed, true);
end;
$$;

revoke all on function check_site_presence_switch() from public, anon, authenticated;
grant execute on function check_site_presence_switch() to anon, authenticated;

create or replace function admin_confirm_site_presence()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
begin
  update site_presence_switch
  set confirmed_at = now(),
      is_closed = false,
      closed_at = null,
      updated_at = now()
  where singleton = true;

  perform log_admin_action(
    v_admin,
    'site_presence.confirmed',
    'site_presence',
    null,
    jsonb_build_object('confirmed_at', now(), 'timezone', 'Africa/Tunis')
  );

  return jsonb_build_object('is_closed', false, 'confirmed_at', now());
end;
$$;

revoke all on function admin_confirm_site_presence() from public, anon, authenticated;
grant execute on function admin_confirm_site_presence() to authenticated;

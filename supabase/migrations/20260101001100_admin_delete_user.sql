-- Permanently delete an account and its auth/profile-linked data.
-- The auth.users foreign key cascades to the public profile and user-owned rows.

create or replace function admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := assert_admin();
  v_target_role user_role;
  v_target_email text;
begin
  if p_user_id is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_user_id = v_admin then
    raise exception 'CANNOT_DELETE_OWN_ACCOUNT' using errcode = '42501';
  end if;

  select role, email into v_target_role, v_target_email
  from profiles
  where id = p_user_id;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_target_role = 'SUPER_ADMIN' and not is_super_admin(v_admin) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  perform log_admin_action(
    v_admin,
    'user.deleted_permanently',
    'profile',
    p_user_id,
    jsonb_build_object('email', v_target_email, 'role', v_target_role),
    null,
    null
  );

  -- auth.users owns the profile row; ON DELETE CASCADE removes dependent data.
  delete from auth.users where id = p_user_id;
end;
$$;

grant execute on function admin_delete_user(uuid) to authenticated;

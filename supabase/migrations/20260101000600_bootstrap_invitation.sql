-- =====================================================================
-- 20260101000600_bootstrap_invitation.sql
--
-- Aligns the invitation-code read model with the provisioning trigger.
--
-- `handle_new_user()` treats the very first account on a fresh install as
-- the owner and lets it through without an inviter, because there is
-- nobody who could have invited it. `is_valid_invitation_code()` did not
-- know about that rule, so `registerAction` rejected every code on an
-- empty database and the owner account could never be created through the
-- UI at all.
--
-- The two now agree: on an empty database any syntactically valid code is
-- accepted (the trigger ignores it and provisions the SUPER_ADMIN owner);
-- from the second account onwards a real, active inviter is required.
-- =====================================================================

create or replace function is_valid_invitation_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when not exists (select 1 from profiles) then true
    else exists (
      select 1 from profiles
      where referral_code = upper(trim(p_code))
        and status = 'ACTIVE'
    )
  end;
$$;

grant execute on function is_valid_invitation_code(text) to anon, authenticated;

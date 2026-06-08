-- 033_approve_access_request_as_role.sql
-- Generalizes 023's teacher-only approval so a founder can provision an approved
-- access request as ANY of: teacher, site_admin, district_admin — with the right
-- scope. This is the UI on-ramp for admin roles (previously only the invite
-- system could mint them, and it had no district scope or redeem UI).
--
-- Provisioning per role (all-or-nothing, founder-gated, SECURITY DEFINER):
--   teacher        -> teachers row + role_assignments('teacher', school_id)   [023 parity]
--   site_admin     -> role_assignments('site_admin', school_id)               [no teachers row]
--   district_admin -> role_assignments('district_admin', district_id)          [no teachers row]
--
-- The unique constraint on role_assignments is (user_id, role, school_id); for a
-- district_admin school_id is NULL and Postgres treats NULLs as distinct, so the
-- district path guards idempotency with an explicit NOT EXISTS on district_id.
-- 023's approve_access_request is left intact (unused by the route now, kept for
-- any direct callers / rollback safety).

create or replace function public.approve_access_request_as_role(
  p_request_id  uuid,
  p_role        text,
  p_school_id   uuid default null,
  p_district_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_req        public.access_requests%rowtype;
  v_teacher_id uuid;
begin
  if not has_role('founder') then
    raise exception 'not authorized: founder role required';
  end if;

  if p_role not in ('teacher', 'site_admin', 'district_admin') then
    raise exception 'invalid role: % (must be teacher, site_admin, or district_admin)', p_role;
  end if;

  select * into v_req from public.access_requests where id = p_request_id;
  if not found then
    raise exception 'access request % not found', p_request_id;
  end if;
  if v_req.status <> 'pending' then
    raise exception 'access request % is already %', p_request_id, v_req.status;
  end if;
  if v_req.user_id is null then
    raise exception 'access request % has no linked auth user', p_request_id;
  end if;

  -- Scope validation
  if p_role in ('teacher', 'site_admin') then
    if p_school_id is null then
      raise exception '% requires a school', p_role;
    end if;
    if not exists (select 1 from public.schools where id = p_school_id) then
      raise exception 'school % does not exist', p_school_id;
    end if;
  else  -- district_admin
    if p_district_id is null then
      raise exception 'district_admin requires a district';
    end if;
    if not exists (select 1 from public.districts where id = p_district_id) then
      raise exception 'district % does not exist', p_district_id;
    end if;
  end if;

  -- Provision per role
  if p_role = 'teacher' then
    if exists (select 1 from public.teachers where auth_id = v_req.user_id) then
      raise exception 'user % already has a teachers row', v_req.user_id;
    end if;
    insert into public.teachers (auth_id, school_id, full_name, email)
    values (v_req.user_id, p_school_id, v_req.full_name, v_req.email)
    returning id into v_teacher_id;
    if not exists (
      select 1 from public.role_assignments
      where user_id = v_req.user_id and role = 'teacher' and school_id = p_school_id
    ) then
      insert into public.role_assignments (user_id, role, school_id, created_by)
      values (v_req.user_id, 'teacher', p_school_id, auth.uid());
    end if;

  elsif p_role = 'site_admin' then
    if not exists (
      select 1 from public.role_assignments
      where user_id = v_req.user_id and role = 'site_admin' and school_id = p_school_id
    ) then
      insert into public.role_assignments (user_id, role, school_id, created_by)
      values (v_req.user_id, 'site_admin', p_school_id, auth.uid());
    end if;

  else  -- district_admin
    if not exists (
      select 1 from public.role_assignments
      where user_id = v_req.user_id and role = 'district_admin'
        and district_id is not distinct from p_district_id
    ) then
      insert into public.role_assignments (user_id, role, district_id, created_by)
      values (v_req.user_id, 'district_admin', p_district_id, auth.uid());
    end if;
  end if;

  update public.access_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  return jsonb_build_object(
    'role', p_role,
    'teacher_id', v_teacher_id,
    'school_id', p_school_id,
    'district_id', p_district_id
  );
end;
$function$;

revoke all on function public.approve_access_request_as_role(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.approve_access_request_as_role(uuid, text, uuid, uuid) to authenticated;

-- 023_approve_access_request.sql
-- Atomic approval of a beta access request. Called by a founder-gated server route.
-- Given a pending access_requests row + a chosen school_id, provisions the user as
-- a teacher in ONE transaction: insert teachers, insert role_assignments (teacher),
-- mark request approved. All-or-nothing. SECURITY DEFINER + internal founder guard.

create or replace function public.approve_access_request(
  p_request_id uuid,
  p_school_id  uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_req     public.access_requests%rowtype;
  v_teacher_id uuid;
begin
  if not has_role('founder') then
    raise exception 'not authorized: founder role required';
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

  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'school % does not exist', p_school_id;
  end if;

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

  update public.access_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  return v_teacher_id;
end;
$function$;

revoke all on function public.approve_access_request(uuid, uuid) from public, anon;
grant execute on function public.approve_access_request(uuid, uuid) to authenticated;

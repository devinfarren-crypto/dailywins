-- 024_harden_ensure_teacher_exists.sql
-- Security hardening: ensure_teacher_exists previously provisioned a teachers row
-- (and fabricated a junk 'My School') for ANYONE who called it, with no approval
-- check. A pending/denied user reaching /dashboard got silently provisioned.
-- FIX: existing teachers unchanged (early return). Creation path now refuses unless
-- the user has an approved access_requests row, and never fabricates a school.

create or replace function public.ensure_teacher_exists(
  p_auth_id uuid,
  p_email text,
  p_full_name text
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_teacher record;
begin
  select t.*, s.name as school_name
  into v_teacher
  from teachers t
  join schools s on s.id = t.school_id
  where t.auth_id = p_auth_id;

  if found then
    return json_build_object(
      'teacher_id', v_teacher.id,
      'school_id', v_teacher.school_id,
      'school_name', v_teacher.school_name,
      'full_name', v_teacher.full_name,
      'email', v_teacher.email,
      'categories', v_teacher.categories,
      'preferences', v_teacher.preferences
    );
  end if;

  if not exists (
    select 1 from public.access_requests
    where user_id = p_auth_id and status = 'approved'
  ) then
    raise exception 'not provisioned: no approved access request for this user'
      using errcode = 'insufficient_privilege';
  end if;

  raise exception 'approved but not provisioned: contact an admin to complete setup'
    using errcode = 'insufficient_privilege';
end;
$function$;

-- Migration 046: org_type — one app, two customer shapes (district | nps)
--
-- The decided architecture (FIELD-GUIDE.md): no fork, no branch. An NPS is an
-- organization with exactly one school where the director holds the admin
-- roles. The single source of truth is districts.org_type; everything that
-- should differ between the shapes (labels, defaults, founder rollups,
-- billing metadata) keys off this one column.
--
-- Also adds the NPS quick-provision path: approving an access request as
-- "NPS Director" stands up the whole school in one atomic step —
--   org (districts row, org_type='nps') + its one school
--   + role_assignments: site_admin (school) AND district_admin (org)
-- so the director gets teachers/schedules/links/usage/audit/notes-archive
-- with zero extra setup. Existing rows default to 'district' (correct for
-- Elk Grove + Sacramento), and approve_access_request_as_role is untouched.
--
-- Rollback: drop function public.approve_access_request_as_nps_director(uuid, text);
--           alter table public.districts drop column org_type;

alter table public.districts
  add column if not exists org_type text not null default 'district'
  check (org_type in ('district', 'nps'));

comment on column public.districts.org_type is
  'Customer shape: district (multi-school LEA, 4 tiers) or nps (single-school non-public school run by a director). Single source of truth — UI labels, defaults, and rollups key off this.';

create or replace function public.approve_access_request_as_nps_director(
  p_request_id uuid,
  p_org_name   text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_req         public.access_requests%rowtype;
  v_org_name    text := trim(p_org_name);
  v_district_id uuid;
  v_school_id   uuid;
begin
  if not has_role('founder') then
    raise exception 'not authorized: founder role required';
  end if;

  if coalesce(length(v_org_name), 0) < 2 then
    raise exception 'NPS organization name is required';
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

  -- The org IS the school for an NPS: one districts row (org_type nps) +
  -- one schools row, both named after the organization.
  insert into public.districts (name, org_type)
  values (v_org_name, 'nps')
  returning id into v_district_id;

  insert into public.schools (name, district, district_id)
  values (v_org_name, v_org_name, v_district_id)
  returning id into v_school_id;

  -- Director = site_admin at the school + district_admin over the org, so
  -- every oversight surface (teachers, schedules, links, usage, scoped
  -- audit, notes archive) just works with no further setup.
  insert into public.role_assignments (user_id, role, school_id, created_by)
  values (v_req.user_id, 'site_admin', v_school_id, auth.uid());

  insert into public.role_assignments (user_id, role, district_id, created_by)
  values (v_req.user_id, 'district_admin', v_district_id, auth.uid());

  update public.access_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  return jsonb_build_object(
    'role', 'nps_director',
    'teacher_id', null,
    'school_id', v_school_id,
    'district_id', v_district_id,
    'org_name', v_org_name
  );
end;
$function$;

grant execute on function public.approve_access_request_as_nps_director(uuid, text) to authenticated;

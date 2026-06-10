-- Migration 042: founder per-district usage view
--
-- get_district_usage() gains an optional p_district_id and a founder path:
--   - founder, no arg      → rollup across ALL districts
--   - founder, district id → that district only
--   - district admin       → own district(s), exactly as before; an explicit
--                            p_district_id outside their scope raises.
-- Aggregate counts only — same PII-blind shape as 034. The old zero-arg
-- signature is dropped (the all-defaults call `rpc('get_district_usage')`
-- resolves to the new function unchanged).
--
-- Rollback: re-run the 034 body (zero-arg) after `drop function
-- public.get_district_usage(uuid);`.

drop function if exists public.get_district_usage();

create or replace function public.get_district_usage(p_district_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_districts uuid[];
  v_result    jsonb;
begin
  if public.has_role('founder') then
    if p_district_id is not null then
      v_districts := array[p_district_id];
    else
      select array_agg(id) into v_districts from public.districts;
    end if;
  else
    select array_agg(distinct district_id) into v_districts
    from public.role_assignments
    where user_id = auth.uid() and role = 'district_admin' and district_id is not null;

    if v_districts is null then
      raise exception 'not authorized: district_admin role required'
        using errcode = 'insufficient_privilege';
    end if;

    if p_district_id is not null then
      if p_district_id = any(v_districts) then
        v_districts := array[p_district_id];
      else
        raise exception 'not authorized for this district'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  if v_districts is null then
    return jsonb_build_object(
      'totals', jsonb_build_object(
        'schools', 0, 'teachers', 0, 'students', 0,
        'active_teachers_7d', 0, 'scores_7d', 0, 'schools_with_schedule', 0
      ),
      'schools', '[]'::jsonb
    );
  end if;

  with sch as (
    select s.id, s.name as school_name, d.name as district_name,
           (s.schedules is not null and s.schedules <> '{}'::jsonb) as has_schedule
    from public.schools s
    join public.districts d on d.id = s.district_id
    where s.district_id = any(v_districts)
  ),
  per_school as (
    select sch.id, sch.school_name, sch.district_name, sch.has_schedule,
      (select count(*) from public.teachers t where t.school_id = sch.id) as teachers,
      (select count(*) from public.students st where st.school_id = sch.id) as students,
      (select count(distinct bs.teacher_id) from public.behavior_scores bs
         join public.teachers t on t.id = bs.teacher_id
         where t.school_id = sch.id and bs.score_date >= current_date - 7) as active_teachers_7d,
      (select count(distinct bs.teacher_id) from public.behavior_scores bs
         join public.teachers t on t.id = bs.teacher_id
         where t.school_id = sch.id and bs.score_date >= current_date - 30) as active_teachers_30d,
      (select count(*) from public.behavior_scores bs
         join public.teachers t on t.id = bs.teacher_id
         where t.school_id = sch.id and bs.score_date >= current_date - 7) as scores_7d,
      (select max(bs.score_date) from public.behavior_scores bs
         join public.teachers t on t.id = bs.teacher_id
         where t.school_id = sch.id) as last_activity
    from sch
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'schools',               (select count(*) from per_school),
      'teachers',              (select coalesce(sum(teachers), 0) from per_school),
      'students',              (select coalesce(sum(students), 0) from per_school),
      'active_teachers_7d',    (select coalesce(sum(active_teachers_7d), 0) from per_school),
      'scores_7d',             (select coalesce(sum(scores_7d), 0) from per_school),
      'schools_with_schedule', (select count(*) from per_school where has_schedule)
    ),
    'schools', (select coalesce(jsonb_agg(jsonb_build_object(
        'school_id', id, 'name', school_name, 'district', district_name,
        'teachers', teachers, 'students', students,
        'active_teachers_7d', active_teachers_7d, 'active_teachers_30d', active_teachers_30d,
        'scores_7d', scores_7d, 'last_activity', last_activity, 'has_schedule', has_schedule
      ) order by district_name, school_name), '[]'::jsonb) from per_school)
  ) into v_result;

  return v_result;
end;
$function$;

grant execute on function public.get_district_usage(uuid) to authenticated;

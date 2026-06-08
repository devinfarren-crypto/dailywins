-- 034_tier_usage_stats.sql
-- PII-blind aggregate usage stats for the admin tiers (docs/TIERED_ARCHITECTURE_v1.1).
--
-- District Admin and Site Admin are PII-blind by RLS: they cannot SELECT
-- behavior_scores / notes / student rows. These SECURITY DEFINER functions are
-- the controlled exception — they compute aggregates server-side in the DB and
-- return ONLY counts / dates, never individual student rows, scores, or note
-- content. No PII crosses the boundary, so the "vendor/admin cannot see student
-- data" guarantee holds. Each function is scoped to the CALLER's own
-- district/school via their role_assignments — a caller can only get numbers for
-- scopes they administer.
--
-- District view: per-SCHOOL rollups only (the doc says a district admin cannot
-- view a teacher roster) — no teacher names/rows.
-- Site view: per-TEACHER activity is allowed (a site admin may view their
-- school's teacher list) but still NO student behavior values — only usage
-- counts (entries logged, last-active date).

-- ── District Admin: per-school aggregate rollups across the caller's districts ──
create or replace function public.get_district_usage()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_districts uuid[];
  v_result    jsonb;
begin
  select array_agg(distinct district_id) into v_districts
  from public.role_assignments
  where user_id = auth.uid() and role = 'district_admin' and district_id is not null;

  if v_districts is null then
    raise exception 'not authorized: district_admin role required'
      using errcode = 'insufficient_privilege';
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
      ) order by school_name), '[]'::jsonb) from per_school)
  ) into v_result;

  return v_result;
end;
$function$;

-- ── Site Admin: per-teacher usage for the caller's school(s) ──
-- Teacher NAMES are allowed (site admin may view their school's teacher list);
-- student behavior values are NOT returned — only usage counts + last-active.
create or replace function public.get_site_usage()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_schools uuid[];
  v_result  jsonb;
begin
  select array_agg(distinct school_id) into v_schools
  from public.role_assignments
  where user_id = auth.uid() and role = 'site_admin' and school_id is not null;

  if v_schools is null then
    raise exception 'not authorized: site_admin role required'
      using errcode = 'insufficient_privilege';
  end if;

  with per_teacher as (
    select t.id, t.full_name, t.school_id, s.name as school_name,
      (select count(*) from public.behavior_scores bs
         where bs.teacher_id = t.id and bs.score_date >= current_date - 7) as scores_7d,
      (select count(*) from public.behavior_scores bs
         where bs.teacher_id = t.id and bs.score_date >= current_date - 30) as scores_30d,
      (select max(bs.score_date) from public.behavior_scores bs where bs.teacher_id = t.id) as last_activity
    from public.teachers t
    join public.schools s on s.id = t.school_id
    where t.school_id = any(v_schools)
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'teachers',           (select count(*) from per_teacher),
      'students',           (select count(*) from public.students st where st.school_id = any(v_schools)),
      'active_teachers_7d', (select count(*) from per_teacher where scores_7d > 0),
      'scores_7d',          (select coalesce(sum(scores_7d), 0) from per_teacher),
      'schools_with_schedule', (select count(*) from public.schools s
                                where s.id = any(v_schools)
                                  and s.schedules is not null and s.schedules <> '{}'::jsonb),
      'schools_total',      (select count(*) from public.schools s where s.id = any(v_schools))
    ),
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
        'teacher_id', id, 'name', full_name, 'school', school_name,
        'scores_7d', scores_7d, 'scores_30d', scores_30d, 'last_activity', last_activity
      ) order by full_name), '[]'::jsonb) from per_teacher)
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.get_district_usage() from public, anon;
revoke all on function public.get_site_usage() from public, anon;
grant execute on function public.get_district_usage() to authenticated;
grant execute on function public.get_site_usage() to authenticated;

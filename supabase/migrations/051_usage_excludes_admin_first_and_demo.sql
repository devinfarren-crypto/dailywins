-- Migration 051: school usage counts reflect the real school
--
-- Two pollution sources surfaced by the 6/11 reviews:
--   1. "What teachers see" mints the director a teachers row (flagged
--      preferences.admin_first) — it was counted as a teacher, inflating
--      Teachers / Active-teachers at a 3-teacher school by 33%.
--   2. [DEMO] students and archived students (049) counted as students.
--
-- get_site_usage now excludes admin_first teacher rows, [DEMO]-prefixed
-- students, and archived students. The teacher LIST keeps admin_first rows
-- out too (the director isn't staff). District rollups (034/042) keep their
-- shapes — districts don't run the demo — and can get the same treatment if
-- a district director flow ever appears.
--
-- Rollback: restore get_site_usage from 034.

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
      and coalesce(t.preferences->>'admin_first', '') <> 'true'  -- the director's demo row is not staff
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'teachers',           (select count(*) from per_teacher),
      'students',           (select count(*) from public.students st
                              where st.school_id = any(v_schools)
                                and st.archived_at is null
                                and st.display_name not like '[DEMO] %'),
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

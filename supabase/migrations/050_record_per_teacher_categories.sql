-- Migration 050: the director's student record scores each row against ITS
-- teacher's category config.
--
-- 047 returned only the most-recent scoring teacher's categories. When two
-- teachers with different configs score the same student (routine at an NPS —
-- students rotate), every other teacher's rows were scored against the wrong
-- config: mismatched category ids read as zeros, wrong maxPoints skew every
-- percentage. Now each score row carries its teacher_id and the payload
-- includes categories_by_teacher, so the client computes each row with the
-- right config. 'categories' (dominant teacher) stays for back-compat.
--
-- (The 038 magic-link views share the dominant-teacher convention; parent and
-- student links are generated per-teacher so the blast radius is smaller, but
-- they're queued for the same treatment.)
--
-- Rollback: restore nps_get_student_record from 047.

create or replace function public.nps_get_student_record(p_student_id uuid)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_school uuid := public.student_school_id(p_student_id);
  v_result jsonb;
begin
  if v_school is null then raise exception 'Unknown student'; end if;
  if not public.is_nps_school_admin(v_school) then
    raise exception 'Not permitted: NPS director access required for this school';
  end if;

  insert into public.audit_log (actor_user_id, action, target_table, target_id)
  values (auth.uid(), 'nps_record.student', 'students', p_student_id);

  select jsonb_build_object(
    'student', (select jsonb_build_object(
        'id', s.id,
        'display_name', coalesce(nullif(trim(s.display_name), ''), trim(s.first_name || ' ' || s.last_name)),
        'archived_at', s.archived_at
      ) from public.students s where s.id = p_student_id),
    -- Back-compat: the dominant (most recent) scoring teacher's set.
    'categories', coalesce((
      select t.categories from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = p_student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '[]'::jsonb),
    -- Every scoring teacher's config, keyed by teacher id — rows are computed
    -- against the config they were written under.
    'categories_by_teacher', coalesce((
      select jsonb_object_agg(t.id::text, t.categories)
      from public.teachers t
      where t.id in (
        select distinct bs3.teacher_id from public.behavior_scores bs3
        where bs3.student_id = p_student_id
      )
    ), '{}'::jsonb),
    'scores', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', bs.id, 'score_date', bs.score_date, 'period', bs.period, 'scores', bs.scores,
        'teacher_id', bs.teacher_id,
        'arrival', bs.arrival, 'compliance', bs.compliance, 'social', bs.social,
        'on_task', bs.on_task, 'phone_away', bs.phone_away
      ) order by bs.score_date, bs.period), '[]'::jsonb)
      from public.behavior_scores bs where bs.student_id = p_student_id),
    -- ALL notes — shared AND private — with teacher attribution. The director
    -- owns the school's record (same rationale as the district notes archive).
    'notes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'note_date', n.note_date, 'period', n.period, 'content', n.content,
        'is_private', n.is_private,
        'teacher_name', (select t.full_name from public.teachers t where t.id = n.teacher_id)
      ) order by n.note_date desc, n.created_at desc), '[]'::jsonb)
      from public.notes n where n.student_id = p_student_id)
  ) into v_result;

  return v_result;
end;
$function$;

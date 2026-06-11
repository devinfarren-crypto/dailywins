-- Migration 049: student soft-delete (archive) — the legal record survives
--
-- Any teacher could hard-DELETE any student at their school (002 policy), and
-- behavior_scores + notes CASCADE away with the row (001). For a product
-- pitched as the school's defensible record ("could be called into a court of
-- law"), roster tidying must never destroy history. Teachers now ARCHIVE
-- (reversible; audited app-side as student.archive); hard delete becomes
-- service-role only (founder maintenance + demo wipe, which bypass RLS).
--
-- The director's roster RPC keeps showing archived students — the record
-- outlives the roster — flagged via archived_at so the UI can badge them.
-- The teacher dashboard filters archived students out of its roster query.
--
-- Rollback:
--   drop policy if exists students_archive_update on public.students;
--   create policy "Teachers can delete students at their school"
--     on public.students for delete using (
--       school_id in (select school_id from public.teachers where auth_id = auth.uid()));
--   alter table public.students drop column archived_at, drop column archived_by;
--   (and restore nps_list_school_students from 047)

alter table public.students
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

comment on column public.students.archived_at is
  'Soft delete: set when a teacher removes the student from their roster. Scores/notes are kept; the director''s records view still shows the student. NULL = active.';

-- The one-click record destroyer, gone.
drop policy if exists "Teachers can delete students at their school" on public.students;

-- Teachers can update students at their school (archive / unarchive / rename).
-- effective_user_id() so act-as sessions resolve to the target teacher.
drop policy if exists students_archive_update on public.students;
create policy students_archive_update on public.students
  for update
  using (school_id in (
    select school_id from public.teachers where auth_id = public.effective_user_id()
  ))
  with check (school_id in (
    select school_id from public.teachers where auth_id = public.effective_user_id()
  ));

-- Roster RPC: same shape as 047 plus archived_at, archived students sorted last.
drop function if exists public.nps_list_school_students(uuid);
create function public.nps_list_school_students(p_school_id uuid)
  returns table(
    id uuid,
    display_name text,
    teacher_names text,
    last_score_date date,
    scores_30d bigint,
    notes_count bigint,
    archived_at timestamptz
  )
  language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_nps_school_admin(p_school_id) then
    raise exception 'Not permitted: NPS director access required for this school';
  end if;
  return query
    select st.id,
           coalesce(nullif(trim(st.display_name), ''), trim(st.first_name || ' ' || st.last_name)) as display_name,
           (select string_agg(distinct t.full_name, ', ')
              from public.behavior_scores bs join public.teachers t on t.id = bs.teacher_id
              where bs.student_id = st.id) as teacher_names,
           (select max(bs.score_date) from public.behavior_scores bs where bs.student_id = st.id) as last_score_date,
           (select count(*) from public.behavior_scores bs
              where bs.student_id = st.id and bs.score_date >= current_date - 30) as scores_30d,
           (select count(*) from public.notes n where n.student_id = st.id) as notes_count,
           st.archived_at
    from public.students st
    where st.school_id = p_school_id
    order by (st.archived_at is not null), 2;
end;
$function$;

grant execute on function public.nps_list_school_students(uuid) to authenticated;

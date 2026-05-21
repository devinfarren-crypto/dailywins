-- Migration 017: student_school_id() SECURITY DEFINER helper (P2)
--
-- Resolves a student's school_id, bypassing the students table's own RLS.
-- The behavior_scores (015) and notes (016) role policies need to know a
-- student's school WITHOUT requiring the querying user to have SELECT on
-- students. Proven on staging 2026-05-21: a site_admin's school-wide score
-- visibility resolves correctly through this helper with NO grant on students.
--
-- The helper is harmless on its own (read-only). Safe to apply ahead of the
-- policy cutover. Once this exists, the commented policies in 015/016 can be
-- updated to call student_school_id() and uncommented at cutover.

create or replace function public.student_school_id(p_student_id uuid)
  returns uuid
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select school_id from public.students where id = p_student_id;
$function$;

grant execute on function public.student_school_id(uuid) to authenticated;

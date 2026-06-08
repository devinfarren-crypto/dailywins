-- 035_site_admin_pii_blind.sql
-- Make the Site Admin tier truly PII-blind, matching docs/TIERED_ARCHITECTURE_v1.1
-- and the public /privacy claim ("administrators cannot view individual student
-- behavior records or teacher notes").
--
-- THE BUG: three SELECT policies granted a site_admin read access to student data
-- at their school — a leftover from an earlier design that v1.1 reversed:
--   behavior_scores.scores_role_read → site admin could read every student's SCORES
--   notes.notes_role_read            → site admin could read all SHARED notes
--   students.students_role_read      → site admin could read the student ROSTER
-- District Admin and Founder were already correctly PII-blind (no SELECT path).
--
-- THE FIX: remove ONLY the `has_role('site_admin', …)` clause from each policy's
-- USING expression. Teacher access is untouched (the teacher_id-owns / teacher-
-- role clauses remain, and the base per-teacher SELECT policies are unchanged), so
-- act-as (via effective_user_id) and normal teacher reads keep working exactly as
-- before. After this, a site admin gets ZERO rows from these tables — the usage
-- dashboards don't rely on this access (they use SECURITY DEFINER aggregate RPCs).

alter policy scores_role_read on public.behavior_scores
  using (
    teacher_id in (
      select teachers.id from public.teachers
      where teachers.auth_id = effective_user_id()
    )
  );

alter policy notes_role_read on public.notes
  using (
    teacher_id in (
      select teachers.id from public.teachers
      where teachers.auth_id = effective_user_id()
    )
    or (is_private = false and has_role('teacher', student_school_id(student_id)))
  );

alter policy students_role_read on public.students
  using (has_role('teacher', school_id));

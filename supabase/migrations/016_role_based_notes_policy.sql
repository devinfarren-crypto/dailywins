-- Migration 016: role-based RLS read policy for notes (P2 — APPLIED TO PROD 2026-05-23)
--
-- Three layers:
--   - Author sees their own notes, private or not (maps teacher_id through teachers.auth_id).
--   - Teacher OR site_admin at the student's school sees NON-PRIVATE notes.
--   - PRIVATE notes are visible ONLY to their author — NOT other teachers, NOT
--     site admins. Privacy holds even against admin oversight. (Product decision.)
--
-- PROVEN STATUS (be precise): the privacy/sharing LOGIC (is_private branching,
-- site_admin path) was verified on a staging fixture 2026-05-21. The teacher
-- IDENTITY mapping bug (initially masked by a fixture using teacher_id =
-- auth.uid()) was caught and fixed 2026-05-22. Full dual-role test against
-- real public.notes passed on staging prior to cutover 2026-05-23.
--
-- CUTOVER NOTE: notes has no school_id, so the school lookup uses the
-- student_school_id() SECURITY DEFINER helper (migration 017, proven on staging
-- 2026-05-21 — resolves correctly with NO grant on students).
--
-- BUG FIX 2026-05-22: notes.teacher_id = teachers.id (not auth.uid()). Caught
-- during staging dry run alongside the same fix in 015. Author path maps through
-- teachers. ALSO: the policy body in the prior commit was truncated/incomplete;
-- this version restores the full statement.

drop policy if exists notes_role_read on public.notes;
create policy notes_role_read
  on public.notes
  for select
  using (
    teacher_id in (select id from public.teachers where auth_id = auth.uid())
    or (
      is_private = false
      and (
        public.has_role('teacher',    public.student_school_id(student_id))
        or public.has_role('site_admin', public.student_school_id(student_id))
      )
    )
  );

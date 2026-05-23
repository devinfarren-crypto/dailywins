-- Migration 014: role-based RLS read policy for students (P2 — APPLIED TO PROD 2026-05-23)
--
-- Proven against a staging fixture 2026-05-21: a Founder+Teacher sees students
-- ONLY through their teacher assignment, never through founder (founder is
-- PII-blind). Cross-school isolation verified.
--
-- Additive to the existing teacher-table-based policy. Cutover executed
-- 2026-05-23 after live users were migrated into role_assignments and the
-- dual-role test passed against real public.students.

drop policy if exists students_role_read on public.students;
create policy students_role_read
  on public.students
  for select
  using (
    public.has_role('teacher', school_id)
    or public.has_role('site_admin', school_id)
  );

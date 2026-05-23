-- Migration 015: role-based RLS read policy for behavior_scores (P2 — APPLIED TO PROD 2026-05-23)
--
-- Two access paths:
--   - Teacher: sees only rows they authored (maps teacher_id through teachers.auth_id).
--     Teachers do NOT see each other's scores, even on the same student.
--   - Site admin: sees all scores for students at a school they administer.
-- Cross-school isolation verified on the fixture (site_admin school scoping).
--
-- PROVEN STATUS (be precise): cross-school isolation and the site_admin path
-- were verified on a staging fixture 2026-05-21. The teacher IDENTITY mapping
-- bug (initially masked by a fixture using teacher_id = auth.uid()) was caught
-- and fixed 2026-05-22. Full dual-role test against real public.behavior_scores
-- passed on staging prior to cutover 2026-05-23.
--
-- CUTOVER NOTE: behavior_scores has no school_id, so the site-admin path uses
-- the student_school_id() SECURITY DEFINER helper (migration 017, proven on
-- staging 2026-05-21 — site_admin school-wide visibility resolves with NO grant
-- on students).

-- BUG FIX 2026-05-22: behavior_scores.teacher_id = teachers.id (not auth.uid()).
-- Caught during staging dry run — the naive teacher_id = auth.uid() matched nothing.
-- The teacher path now maps through teachers, matching the existing 001 policy.
drop policy if exists scores_role_read on public.behavior_scores;
create policy scores_role_read
  on public.behavior_scores
  for select
  using (
    teacher_id in (select id from public.teachers where auth_id = auth.uid())
    or public.has_role('site_admin', public.student_school_id(student_id))
  );

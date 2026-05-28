-- 028: RLS rewrite for act-as (Phase 5 follow-up to migration 027).
--
-- HIGH-RISK MIGRATION. Touches RLS policies that gate live student PII data.
-- Apply to staging first if possible; otherwise eyeball the diff carefully
-- and have a rollback plan (drop new policies, restore old ones).
--
-- COMPANION: docs/ACT_AS_DESIGN_v1.md.
--
-- WHAT THIS DOES
-- Switches the data-access RLS layer from `auth.uid()` to `effective_user_id()`
-- so that during an active act_as_session, the impersonator sees what the
-- target sees. Attribution-stamping (created_by, reviewed_by, audit_log.actor_user_id)
-- continues to use auth.uid() directly — the actor is still the real-world doer.
--
-- TWO FUNCTIONS REWRITTEN (auth.uid() → effective_user_id()):
--   1. has_role() — used by *_role_read policies and admin gating routes.
--      Side effect: while act-as'd as a non-founder, the impersonator no
--      longer passes has_role('founder') checks. Correct: you shouldn't
--      approve access requests while pretending to be a teacher.
--   2. is_school_admin() — used by dashboard's Site Admin tools gate.
--
-- POLICIES REWRITTEN
--   - behavior_scores: 4 teacher-self policies + scores_role_read
--   - notes: 4 teacher-self policies + "view own and shared" + notes_role_read
--   - students: 3 teacher-self policies + students_role_read
--   - teachers: 2 self-profile policies
--
-- WHAT IS NOT TOUCHED
--   - schools, access_requests, role_assignments, magic_links, magic_link_uses,
--     act_as_sessions, audit_log, districts policies. None of these gate
--     student PII access directly.
--   - All audit-stamp uses of auth.uid() (e.g. role_assignments.created_by =
--     auth.uid() in approve_access_request).
--
-- ROLLBACK PLAN
-- Drop all CREATE POLICY statements below, then restore the originals (kept
-- in this file's comments and reproducible from the pg_policies snapshot
-- taken before this migration ran).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. has_role() — route through effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.has_role(p_role text, p_school_id uuid DEFAULT NULL::uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_assignments ra
    WHERE ra.user_id = effective_user_id()
      AND ra.role = p_role
      AND (ra.school_id IS NULL OR ra.school_id = p_school_id)
  );
$$;

COMMENT ON FUNCTION public.has_role(text, uuid) IS
  'Role check against role_assignments. Uses effective_user_id() so the check
   resolves to the act-as target during an active session. For attribution
   (e.g. role_assignments.created_by) use auth.uid() directly.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. is_school_admin() — route through effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_school_admin(target_school_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_admins
    WHERE user_id = effective_user_id()
      AND school_id = target_school_id
  );
$$;

COMMENT ON FUNCTION public.is_school_admin(uuid) IS
  'Site Admin check. Uses effective_user_id() so an act-as impersonator
   gets the target''s admin status, not their own.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. behavior_scores policies — teacher-self lookups via effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can view own scores" ON public.behavior_scores;
DROP POLICY IF EXISTS "Teachers can insert own scores" ON public.behavior_scores;
DROP POLICY IF EXISTS "Teachers can update own scores" ON public.behavior_scores;
DROP POLICY IF EXISTS "Teachers can delete own scores" ON public.behavior_scores;
DROP POLICY IF EXISTS "scores_role_read" ON public.behavior_scores;

CREATE POLICY "Teachers can view own scores"
  ON public.behavior_scores FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can insert own scores"
  ON public.behavior_scores FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can update own scores"
  ON public.behavior_scores FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can delete own scores"
  ON public.behavior_scores FOR DELETE
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "scores_role_read"
  ON public.behavior_scores FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
    OR has_role('site_admin'::text, student_school_id(student_id))
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 4. notes policies — teacher-self lookups via effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can view own and shared notes" ON public.notes;
DROP POLICY IF EXISTS "Teachers can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Teachers can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Teachers can delete own notes" ON public.notes;
DROP POLICY IF EXISTS "notes_role_read" ON public.notes;

CREATE POLICY "Teachers can view own and shared notes"
  ON public.notes FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
    OR (
      is_private = false
      AND student_id IN (
        SELECT s.id
        FROM public.students s
        JOIN public.teachers t ON t.school_id = s.school_id
        WHERE t.auth_id = effective_user_id()
      )
    )
  );

CREATE POLICY "Teachers can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can update own notes"
  ON public.notes FOR UPDATE
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can delete own notes"
  ON public.notes FOR DELETE
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "notes_role_read"
  ON public.notes FOR SELECT
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE auth_id = effective_user_id()
    )
    OR (
      is_private = false
      AND (
        has_role('teacher'::text, student_school_id(student_id))
        OR has_role('site_admin'::text, student_school_id(student_id))
      )
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 5. students policies — teacher-self lookups via effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can view students at their school" ON public.students;
DROP POLICY IF EXISTS "Teachers can insert students at their school" ON public.students;
DROP POLICY IF EXISTS "Teachers can delete students at their school" ON public.students;
-- students_role_read already uses has_role() which we just rewrote;
-- recreating it for explicitness + comment continuity.
DROP POLICY IF EXISTS "students_role_read" ON public.students;

CREATE POLICY "Teachers can view students at their school"
  ON public.students FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can insert students at their school"
  ON public.students FOR INSERT
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "Teachers can delete students at their school"
  ON public.students FOR DELETE
  USING (
    school_id IN (
      SELECT school_id FROM public.teachers WHERE auth_id = effective_user_id()
    )
  );

CREATE POLICY "students_role_read"
  ON public.students FOR SELECT
  USING (
    has_role('teacher'::text, school_id)
    OR has_role('site_admin'::text, school_id)
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 6. teachers policies — self-profile via effective_user_id()
-- ───────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers can view own profile" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teachers;

CREATE POLICY "Teachers can view own profile"
  ON public.teachers FOR SELECT
  USING (auth_id = effective_user_id());

CREATE POLICY "Teachers can update own profile"
  ON public.teachers FOR UPDATE
  USING (auth_id = effective_user_id());

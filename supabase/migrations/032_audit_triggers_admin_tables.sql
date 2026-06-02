-- 032_audit_triggers_admin_tables.sql
-- Phase 4 audit-coverage expansion: extend the generic audit trigger from the
-- three PII tables (029) to the administrative / configuration tables —
-- role_assignments, school_admins, schools, districts — so role grants, admin
-- assignments, school edits, and district changes land in public.audit_log.
--
-- ⚠️ DRAFT — NOT YET APPLIED TO PROD. Staged for Devin to review + stage-test,
-- then apply via MCP apply_migration. (No staging branch is reachable through
-- the prod-pinned MCP, so a guarded apply + verification is the path.)
--
-- ── Design / coverage model ──────────────────────────────────────────────────
-- This reuses the SAME generic function from 029, public.audit_row_change(),
-- which keys attribution on auth.uid():
--   • JWT-context writes (a user acting through their session)  → trigger fires,
--     actor = auth.uid(), act-as session resolved as in 029.
--   • service-role writes (server routes via the admin client) → auth.uid() is
--     NULL, so the trigger NO-OPS. Those paths must call writeAuditLog()
--     themselves with known-actor attribution.
-- We only extend the alias CASE (for nice action names) and attach triggers;
-- the function body is otherwise identical to 029. CREATE OR REPLACE keeps it a
-- single source of truth, so 029's tables keep working unchanged.
--
-- ── The schedule-edit gap (the motivating case) ──────────────────────────────
-- Bell-schedule edits are writes to schools.schedules made by the Site Admin
-- editor via the service-role client (app/api/schedule/save). auth.uid() is
-- NULL there, so the schools trigger below NO-OPS on them. That gap is closed
-- in the APP layer, not here: app/api/schedule/save/route.ts now calls
-- writeAuditLog() with action 'schedule.update' (companion change in this
-- branch). The schools trigger still backstops any future JWT-context school
-- edit. Net: schedule edits are audited (app layer), school edits via session
-- are audited (trigger) — no path double-writes, because each write path uses
-- exactly one mechanism.
--
-- ── Known complementary write to FLAG for review ─────────────────────────────
-- approve_access_request runs under the founder's JWT (see app/api/admin/
-- approve), so the role_assignments INSERT it performs WILL fire this trigger
-- (action 'role_assignment.insert', actor=founder) IN ADDITION to the approve
-- route's explicit writeAuditLog('access_request.approve'). These are not true
-- duplicates — different actions; the trigger row carries the full
-- role_assignments before/after, the route row carries the semantic approve.
-- DECISION FOR DEVIN: keep both (richer trail, recommended) or exclude
-- role_assignments from triggers to avoid the extra row. Drafted as "keep both".
--
-- Idempotent: CREATE OR REPLACE on the function; DROP TRIGGER IF EXISTS before
-- each CREATE. Safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Extend the generic function's alias map (body otherwise identical to 029)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.audit_row_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_actor       uuid := auth.uid();
  v_target      uuid;
  v_break_glass boolean := false;
  v_alias       text;
  v_action      text;
  v_target_id   uuid;
BEGIN
  -- Service-role writes (no JWT): caller is expected to writeAuditLog(). Skip.
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT target_user_id, break_glass
    INTO v_target, v_break_glass
  FROM public.act_as_sessions
  WHERE actor_user_id = v_actor
    AND ended_at IS NULL
    AND expires_at > now()
  ORDER BY started_at DESC
  LIMIT 1;

  -- Alias map extended with the admin/config tables. Falls back to the raw
  -- table name so an unmapped future table still yields a usable action.
  v_alias := CASE TG_TABLE_NAME
    WHEN 'behavior_scores'  THEN 'score'
    WHEN 'notes'            THEN 'note'
    WHEN 'students'         THEN 'student'
    WHEN 'role_assignments' THEN 'role_assignment'
    WHEN 'school_admins'    THEN 'school_admin'
    WHEN 'schools'          THEN 'school'
    WHEN 'districts'        THEN 'district'
    ELSE TG_TABLE_NAME
  END;

  v_action := v_alias || '.' || lower(TG_OP);

  v_target_id := CASE TG_OP
    WHEN 'DELETE' THEN OLD.id
    ELSE NEW.id
  END;

  INSERT INTO public.audit_log (
    actor_user_id,
    acting_as_user_id,
    action,
    target_table,
    target_id,
    before,
    after,
    break_glass
  ) VALUES (
    v_actor,
    v_target,
    v_action,
    TG_TABLE_NAME,
    v_target_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb END,
    COALESCE(v_break_glass, false)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.audit_row_change() IS
  'Generic AFTER row trigger: one audit_log row per INSERT/UPDATE/DELETE on attached tables. No-ops when auth.uid() is NULL (service-role writes are caller-audited via writeAuditLog). Resolves active act-as session for acting_as_user_id + break_glass. Alias map covers PII tables (029) + admin/config tables (032).';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Attach triggers to the admin/config tables (4 tables × 3 ops)
-- ───────────────────────────────────────────────────────────────────────────

-- role_assignments
DROP TRIGGER IF EXISTS audit_role_assignments_insert ON public.role_assignments;
DROP TRIGGER IF EXISTS audit_role_assignments_update ON public.role_assignments;
DROP TRIGGER IF EXISTS audit_role_assignments_delete ON public.role_assignments;

CREATE TRIGGER audit_role_assignments_insert
  AFTER INSERT ON public.role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_role_assignments_update
  AFTER UPDATE ON public.role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_role_assignments_delete
  AFTER DELETE ON public.role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- school_admins
DROP TRIGGER IF EXISTS audit_school_admins_insert ON public.school_admins;
DROP TRIGGER IF EXISTS audit_school_admins_update ON public.school_admins;
DROP TRIGGER IF EXISTS audit_school_admins_delete ON public.school_admins;

CREATE TRIGGER audit_school_admins_insert
  AFTER INSERT ON public.school_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_school_admins_update
  AFTER UPDATE ON public.school_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_school_admins_delete
  AFTER DELETE ON public.school_admins
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- schools  (school edits via session; schedule edits are audited app-side)
DROP TRIGGER IF EXISTS audit_schools_insert ON public.schools;
DROP TRIGGER IF EXISTS audit_schools_update ON public.schools;
DROP TRIGGER IF EXISTS audit_schools_delete ON public.schools;

CREATE TRIGGER audit_schools_insert
  AFTER INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_schools_update
  AFTER UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_schools_delete
  AFTER DELETE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- districts
DROP TRIGGER IF EXISTS audit_districts_insert ON public.districts;
DROP TRIGGER IF EXISTS audit_districts_update ON public.districts;
DROP TRIGGER IF EXISTS audit_districts_delete ON public.districts;

CREATE TRIGGER audit_districts_insert
  AFTER INSERT ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_districts_update
  AFTER UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_districts_delete
  AFTER DELETE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Staging verification checklist (run by hand after applying)
-- ───────────────────────────────────────────────────────────────────────────
--
-- As a founder via the app (JWT):
--   • Edit a school's schedule in the Site Admin editor → expect ONE audit_log
--     row, action='schedule.update' (from the app-layer writeAuditLog), actor=
--     founder, before/after = schedules JSONB. The schools UPDATE trigger should
--     NOT add a second row (service-role write → auth.uid() NULL → no-op).
--   • Approve a pending access request → expect 'access_request.approve' (route)
--     AND 'role_assignment.insert' (trigger). Confirm this is the intended
--     "keep both" behavior or flip the decision (see header).
--   • Add/remove a Site Admin (school_admins) via JWT → 'school_admin.insert' /
--     '.delete'.
-- Confirm no app errors and no perceptible latency on schedule save.

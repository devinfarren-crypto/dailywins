-- 029_audit_triggers.sql
-- Phase 4 audit-coverage backstop: Postgres triggers on the three PII-bearing
-- tables (behavior_scores, notes, students) write to public.audit_log on every
-- INSERT, UPDATE, and DELETE. Closes the "determined teacher could bypass the
-- client-side fireAuditEvent call" gap flagged in ROADMAP.md (5/29 EOD).
--
-- Design notes:
--   - One generic trigger function `audit_row_change()` is attached as nine
--     row-level AFTER triggers (3 tables × 3 ops). Single source of truth for
--     the audit row shape; each trigger is a thin attachment.
--   - SECURITY DEFINER so the function can INSERT into audit_log even though
--     audit_log has no INSERT policy (writes are mediated server-side by
--     convention; the trigger function is part of that mediation).
--   - When auth.uid() is NULL the trigger no-ops. That's the case for writes
--     issued via the service-role admin client (server routes). Those code
--     paths already call writeAuditLog() with proper attribution; the trigger
--     stepping aside prevents double-writes.
--   - When auth.uid() is non-NULL (i.e. a JWT-bearing user wrote via the SSR
--     client or directly via supabase-js), the trigger looks up an active
--     act-as session for the actor and populates acting_as_user_id +
--     break_glass from it. If no session exists, acting_as_user_id is NULL.
--   - before/after hold full row_to_json. audit_log is admin-readable only
--     (founder + self + acting-as target via the existing
--     audit_log_select_self_or_founder policy), so this is acceptable.
--
-- Coverage gap this DOES NOT close: writes by service_role from server routes
-- that forget to call writeAuditLog(). Trigger can't help there because we
-- want the server's known-actor attribution, not a NULL. Audit those code
-- paths in review.
--
-- Companion follow-up commit (NOT in this migration): remove redundant
-- fireAuditEvent calls for score/note/student CRUD in app/dashboard and
-- elsewhere. Keep fireAuditEvent for actions triggers cannot see
-- (act_as.start/.end, access_request.approve/.deny, magic_link.*, etc.).
--
-- Idempotent: function uses CREATE OR REPLACE; triggers are dropped if
-- present before recreate.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Generic audit trigger function
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
  -- Service-role writes (no JWT). Server route is expected to call
  -- writeAuditLog() with proper attribution. Skip to avoid NULL-actor rows.
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Active act-as session for this actor, if any. Mirrors effective_user_id()
  -- but pulls break_glass at the same time so we don't query twice.
  SELECT target_user_id, break_glass
    INTO v_target, v_break_glass
  FROM public.act_as_sessions
  WHERE actor_user_id = v_actor
    AND ended_at IS NULL
    AND expires_at > now()
  ORDER BY started_at DESC
  LIMIT 1;

  -- Short alias for action naming. Falls back to TG_TABLE_NAME if the table
  -- isn't in the map, so adding a future table without updating this CASE
  -- still produces a usable action string.
  v_alias := CASE TG_TABLE_NAME
    WHEN 'behavior_scores' THEN 'score'
    WHEN 'notes'           THEN 'note'
    WHEN 'students'        THEN 'student'
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
    v_target,                                -- NULL when no active session
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
  'Generic AFTER row trigger: writes one audit_log row per INSERT/UPDATE/DELETE on tables it is attached to. No-ops when auth.uid() is NULL (service-role writes are caller-audited). Looks up active act-as session to populate acting_as_user_id + break_glass.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Attach triggers (3 tables × 3 ops)
-- ───────────────────────────────────────────────────────────────────────────

-- behavior_scores
DROP TRIGGER IF EXISTS audit_behavior_scores_insert ON public.behavior_scores;
DROP TRIGGER IF EXISTS audit_behavior_scores_update ON public.behavior_scores;
DROP TRIGGER IF EXISTS audit_behavior_scores_delete ON public.behavior_scores;

CREATE TRIGGER audit_behavior_scores_insert
  AFTER INSERT ON public.behavior_scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_behavior_scores_update
  AFTER UPDATE ON public.behavior_scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_behavior_scores_delete
  AFTER DELETE ON public.behavior_scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- notes
DROP TRIGGER IF EXISTS audit_notes_insert ON public.notes;
DROP TRIGGER IF EXISTS audit_notes_update ON public.notes;
DROP TRIGGER IF EXISTS audit_notes_delete ON public.notes;

CREATE TRIGGER audit_notes_insert
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_notes_update
  AFTER UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_notes_delete
  AFTER DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- students
DROP TRIGGER IF EXISTS audit_students_insert ON public.students;
DROP TRIGGER IF EXISTS audit_students_update ON public.students;
DROP TRIGGER IF EXISTS audit_students_delete ON public.students;

CREATE TRIGGER audit_students_insert
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_students_update
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

CREATE TRIGGER audit_students_delete
  AFTER DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Staging verification checklist (run as comments / by hand on staging)
-- ───────────────────────────────────────────────────────────────────────────
--
-- As a regular teacher (JWT, no act-as):
--   INSERT a behavior_scores row → expect audit_log row with action='score.insert',
--     actor_user_id=teacher.auth_id, acting_as_user_id IS NULL, after populated.
--   UPDATE → action='score.update', before AND after populated.
--   DELETE → action='score.delete', before populated, after IS NULL.
--   Repeat for notes (note.insert/.update/.delete) and students.
--
-- As a founder acting-as a teacher:
--   Start act-as session for teacher.
--   INSERT a note → expect actor_user_id=founder, acting_as_user_id=teacher,
--     break_glass=false (or true if break-glass session).
--   End act-as. INSERT another note → acting_as_user_id IS NULL again.
--
-- As a server route using the admin client (service_role):
--   Trigger a write that goes through createAdminClient — e.g., approve a
--   pending access request (which provisions a teachers row). Expect: the
--   server route writes its OWN audit_log row (access_request.approve, etc.)
--   AND the trigger does NOT fire on the teachers/role_assignments writes
--   (auth.uid() is NULL there). No duplicate rows.
--
-- Confirm no app errors in the dashboard during normal teacher use — trigger
-- adds ~1–2ms per write, which should be invisible.

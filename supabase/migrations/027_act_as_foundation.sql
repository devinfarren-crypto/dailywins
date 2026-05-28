-- 027: Act-as foundation (Phase 5).
--
-- Schema foundation only. RLS migration of existing PII-gated policies to use
-- effective_user_id() is in a separate migration (028) so it can be reviewed
-- and tested on its own. No existing policies are modified here.
--
-- Companion doc: docs/ACT_AS_DESIGN_v1.md.
--
-- Idempotent where reasonable. Backfills districts from existing schools.district
-- text values. Safe to run on a database with existing rows.
--
-- IMPORTANT ordering: all column ALTERs that other objects reference (e.g.
-- role_assignments.district_id is referenced by districts policies) MUST run
-- before the dependent CREATE POLICY statements. First failed apply (5/28)
-- was caused by adding role_assignments.district_id after the districts
-- policy that referenced it.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. districts table (structure only; policies added after dependent columns)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.districts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  state       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.districts IS
  'School districts. Promoted from schools.district text in migration 027 to support District Admin scope queries.';

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. schools.district_id (FK to districts.id), backfilled from schools.district
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id);

-- Backfill: create a districts row for each distinct schools.district value,
-- then populate schools.district_id. ON CONFLICT lets this be re-run safely.
INSERT INTO public.districts (name)
SELECT DISTINCT district FROM public.schools
WHERE district IS NOT NULL AND length(trim(district)) > 0
ON CONFLICT (name) DO NOTHING;

UPDATE public.schools s
SET district_id = d.id
FROM public.districts d
WHERE s.district = d.name
  AND s.district_id IS NULL;

CREATE INDEX IF NOT EXISTS schools_district_id_idx
  ON public.schools(district_id);

-- schools.district (text) is NOT dropped here. Drop happens in a later
-- migration once we've confirmed nothing reads it.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. role_assignments.district_id (for District Admin scope)
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE public.role_assignments
  ADD COLUMN IF NOT EXISTS district_id uuid REFERENCES public.districts(id);

CREATE INDEX IF NOT EXISTS role_assignments_district_idx
  ON public.role_assignments(district_id) WHERE district_id IS NOT NULL;

COMMENT ON COLUMN public.role_assignments.district_id IS
  'For District Admin assignments. NULL for non-district roles. Mutually exclusive with school_id in practice (a D-A assignment has district_id set and school_id null).';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. districts RLS policies (now that role_assignments.district_id exists)
-- ───────────────────────────────────────────────────────────────────────────

CREATE POLICY "districts_select_authenticated"
  ON public.districts FOR SELECT
  USING (
    has_role('founder')
    OR EXISTS (
      SELECT 1 FROM public.role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND (ra.district_id = districts.id OR ra.district_id IS NULL)
    )
  );

CREATE POLICY "districts_modify_founder_only"
  ON public.districts FOR ALL
  USING (has_role('founder'))
  WITH CHECK (has_role('founder'));

-- ───────────────────────────────────────────────────────────────────────────
-- 5. act_as_sessions
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.act_as_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid NOT NULL REFERENCES auth.users(id),
  target_user_id  uuid NOT NULL REFERENCES auth.users(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  ended_at        timestamptz,
  break_glass     boolean NOT NULL DEFAULT false,
  reason          text,
  CONSTRAINT act_as_break_glass_requires_reason
    CHECK (NOT break_glass OR (reason IS NOT NULL AND length(trim(reason)) > 0)),
  CONSTRAINT act_as_actor_target_distinct
    CHECK (actor_user_id <> target_user_id)
);

-- One open session per actor; one open session per target.
CREATE UNIQUE INDEX IF NOT EXISTS act_as_one_open_per_actor
  ON public.act_as_sessions(actor_user_id) WHERE ended_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS act_as_one_open_per_target
  ON public.act_as_sessions(target_user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS act_as_sessions_actor_idx
  ON public.act_as_sessions(actor_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS act_as_sessions_target_idx
  ON public.act_as_sessions(target_user_id, started_at DESC);

ALTER TABLE public.act_as_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "act_as_sessions_select_self_or_founder"
  ON public.act_as_sessions FOR SELECT
  USING (
    actor_user_id = auth.uid()
    OR target_user_id = auth.uid()
    OR has_role('founder')
  );

CREATE POLICY "act_as_sessions_modify_founder_only"
  ON public.act_as_sessions FOR ALL
  USING (has_role('founder'))
  WITH CHECK (has_role('founder'));

COMMENT ON TABLE public.act_as_sessions IS
  'One row per act-as session. actor_user_id holds the impersonator; target_user_id holds the impersonated user. effective_user_id() reads this table to resolve PII-access queries during an active session.';

-- ───────────────────────────────────────────────────────────────────────────
-- 6. audit_log (foundation for Phase 4; act-as is the first writer)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id      uuid NOT NULL,
  acting_as_user_id  uuid,
  action             text NOT NULL,
  target_table       text,
  target_id          uuid,
  before             jsonb,
  after              jsonb,
  reason             text,
  break_glass        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_actor_idx
  ON public.audit_log(actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_acting_as_idx
  ON public.audit_log(acting_as_user_id, created_at DESC)
  WHERE acting_as_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_log_action_idx
  ON public.audit_log(action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_target_idx
  ON public.audit_log(target_table, target_id, created_at DESC)
  WHERE target_table IS NOT NULL;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_self_or_founder"
  ON public.audit_log FOR SELECT
  USING (
    has_role('founder')
    OR actor_user_id = auth.uid()
    OR acting_as_user_id = auth.uid()
  );

CREATE POLICY "audit_log_no_update"
  ON public.audit_log FOR UPDATE
  USING (false);

CREATE POLICY "audit_log_no_delete"
  ON public.audit_log FOR DELETE
  USING (false);

COMMENT ON TABLE public.audit_log IS
  'Append-only audit trail. v1 writes during act-as sessions; later phases extend to all admin actions. acting_as_user_id is non-null when the row was produced during an act-as session.';

-- ───────────────────────────────────────────────────────────────────────────
-- 7. effective_user_id() — the dual-identity resolver
-- ───────────────────────────────────────────────────────────────────────────

-- Returns the act-as target if the current auth.uid() has an open, unexpired
-- act_as_sessions row; otherwise returns auth.uid().
--
-- STABLE so the query planner can cache within a statement. SECURITY DEFINER
-- so it can read act_as_sessions even from RLS-restricted callers.
--
-- Important: callers using this for PII-gating must accept that the actor
-- temporarily sees data as the target. Attribution-stamping queries
-- (created_by, reviewed_by, etc.) MUST continue to use auth.uid() directly.

CREATE OR REPLACE FUNCTION public.effective_user_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT target_user_id
      FROM public.act_as_sessions
      WHERE actor_user_id = auth.uid()
        AND ended_at IS NULL
        AND expires_at > now()
      ORDER BY started_at DESC
      LIMIT 1
    ),
    auth.uid()
  );
$$;

COMMENT ON FUNCTION public.effective_user_id() IS
  'Dual-identity resolver. Returns act-as target if caller has an open unexpired session, else auth.uid(). Use for PII-gating RLS only; use auth.uid() for attribution.';

GRANT EXECUTE ON FUNCTION public.effective_user_id() TO authenticated;

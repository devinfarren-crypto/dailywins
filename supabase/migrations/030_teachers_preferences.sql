-- 030_teachers_preferences.sql
-- Add the JSONB preferences column to public.teachers.
--
-- WHY: The dashboard Customize modal has had per-teacher preferences (theme,
-- font, confetti, compact mode, and now "Show Period 0") since long before
-- this migration, but the savePreferences() write target — teachers.preferences
-- — only existed on staging, not prod. Every toggle has been working
-- in-session via React state and silently failing to persist on sign-out.
-- Captured as a ROADMAP "tracked drift" item ("teachers.preferences drift:
-- column exists on staging, not prod. Footgun").
--
-- This migration closes the drift by adding the column with a safe empty-JSON
-- default. No existing data needs to migrate: every teacher row gets {} and
-- the dashboard reader defaults each field individually when absent.
--
-- IDEMPOTENT via IF NOT EXISTS — safe to re-run; safe to apply on staging
-- (where the column already exists from a prior live-only add) without error.
--
-- The Customize modal client (app/dashboard/DashboardClient.tsx) already calls
-- supabase.from("teachers").update({ preferences: ... }). No client change
-- required. The SELECT path at app/dashboard/DashboardClient.tsx around the
-- profile load was defensively avoiding this column with a comment about the
-- drift — that defensive skip can be removed in a follow-up commit once this
-- migration is live in prod.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.teachers.preferences IS
  'Per-teacher UI preferences (theme, font, confetti, compact, showPeriodZero). Shape validated at the application layer (Preferences interface in DashboardClient). Defaults to empty object so missing fields fall through to the dashboard''s own defaults.';

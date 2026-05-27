-- 025_allow_period_zero.sql
-- Widen behavior_scores.period check constraint from (1..8) to (0..8).
--
-- BUG: schools with a "Period 0" in their schedule (zero-period, prep blocks, etc.)
-- could not save scores. The frontend sent period: 0 in every upsert batch,
-- Postgres rejected the entire batch with check_violation 23514, and the dashboard
-- save silently failed (console-only error). Found via DevTools — error 'new row
-- for relation "behavior_scores" violates check constraint
-- "behavior_scores_period_check"'.
--
-- The schedules JSONB already permits Period 0; only this check was stale.

alter table public.behavior_scores
  drop constraint behavior_scores_period_check;

alter table public.behavior_scores
  add constraint behavior_scores_period_check check (period between 0 and 8);

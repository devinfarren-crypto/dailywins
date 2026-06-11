-- Migration 052: launch state lives with the school, not the browser
--
-- The director-home launch wizard's "finished" flag was localStorage-only —
-- finish setup on the office iMac, open a laptop, get the wizard again.
-- One timestamp on schools; set via POST /api/admin/launch-finished (site
-- admin of that school), read by /admin/home. localStorage stays as a cache.
--
-- Rollback: alter table public.schools drop column launch_finished_at;

alter table public.schools
  add column if not exists launch_finished_at timestamptz;

comment on column public.schools.launch_finished_at is
  'When the admin-home launch sequence was completed for this school (any device). NULL = wizard still shows.';

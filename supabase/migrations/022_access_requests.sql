-- 022_access_requests.sql
-- Beta access-request queue for DailyWins.
-- Anyone can submit a request (name + email + school). Founders review/approve.
-- Approval itself (provisioning a teachers row) happens in app logic, NOT here.
--
-- RLS model:
--   INSERT  : anyone (anon + authenticated) may submit a request
--   SELECT  : founders only
--   UPDATE  : founders only (to set status / reviewed_at / reviewed_by)
--   DELETE  : no policy (keep an audit trail; service_role can still purge if needed)
--
-- Gating uses the existing has_role('founder') helper. Founder assignments are
-- global (role_assignments.school_id IS NULL), which has_role() handles when
-- called with no school argument.

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  full_name    text not null,
  school_name  text,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'denied')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id)
);

-- Basic non-blank validation on email and name. NOTE: this does not normalize
-- case/whitespace — the app/form should lowercase + trim email before insert so
-- the eventual provisioning step and dedupe-by-eye compare cleanly.
alter table public.access_requests
  add constraint access_requests_email_not_blank
  check (length(trim(email)) > 0);

alter table public.access_requests
  add constraint access_requests_name_not_blank
  check (length(trim(full_name)) > 0);

-- Helpful index for the admin queue (newest pending first is the common view).
create index if not exists access_requests_status_created_idx
  on public.access_requests (status, created_at desc);

alter table public.access_requests enable row level security;

-- Anyone may submit a request, but only as a 'pending' row. Forcing the status
-- in WITH CHECK prevents an anon submitter from self-approving (e.g. inserting
-- status = 'approved'). The eventual approval is a founder UPDATE, never an insert.
create policy "Anyone can submit a pending access request"
  on public.access_requests
  for insert
  to anon, authenticated
  with check (status = 'pending');

-- Founders can read the full queue.
create policy "Founders can read access requests"
  on public.access_requests
  for select
  to authenticated
  using (has_role('founder'));

-- Founders can update request status.
create policy "Founders can update access requests"
  on public.access_requests
  for update
  to authenticated
  using (has_role('founder'))
  with check (has_role('founder'));

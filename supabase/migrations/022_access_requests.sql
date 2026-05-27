-- 022_access_requests.sql
-- Beta access-request / pending-user queue for DailyWins.
--
-- Flow (decided May 27, Nick concurring):
--   1. New tester signs in FIRST (creates their auth.users row).
--   2. They land on a "pending approval" wall and submit name + school.
--      That submission is written by a SERVER API ROUTE using the service-role
--      key (service_role BYPASSES RLS) — matches DailyWins' mediated-write pattern.
--      The row carries user_id (their auth id) so approval is unambiguous.
--   3. A founder reads/approves the queue in the admin page via their own
--      authenticated founder SESSION — so the SELECT/UPDATE policies below are
--      load-bearing for that path. There is no INSERT policy: the only writer is
--      the service-role server route, which bypasses RLS.
--   4. Approval = provisioning the user's teachers / role_assignment row
--      (done in app logic, NOT here). That row is what RLS keys off to grant access.
--
-- Gating uses has_role('founder'). Founder assignments are global
-- (role_assignments.school_id IS NULL), which has_role() handles with no school arg.

create table if not exists public.access_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id),
  email        text not null,
  full_name    text not null,
  school_name  text,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'denied')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references auth.users(id)
);

alter table public.access_requests
  add constraint access_requests_email_not_blank check (length(trim(email)) > 0);
alter table public.access_requests
  add constraint access_requests_name_not_blank check (length(trim(full_name)) > 0);

create unique index if not exists access_requests_user_unique
  on public.access_requests (user_id) where user_id is not null;
create index if not exists access_requests_status_created_idx
  on public.access_requests (status, created_at desc);

-- Table GRANTs (RLS policies are moot without base privileges). authenticated gets
-- SELECT + UPDATE; the founder-only policies below filter who can read/approve.
-- Writes (inserts) are mediated server-side via service_role, so no INSERT grant.
grant select, update on public.access_requests to authenticated;

alter table public.access_requests enable row level security;

create policy "Founders can read access requests"
  on public.access_requests for select to authenticated
  using (has_role('founder'));

create policy "Founders can update access requests"
  on public.access_requests for update to authenticated
  using (has_role('founder')) with check (has_role('founder'));

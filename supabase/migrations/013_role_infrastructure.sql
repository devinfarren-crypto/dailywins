-- Migration 013: role infrastructure (P2, ships dark)
--
-- Adds the role machinery for the 4-tier hierarchy WITHOUT changing any
-- existing behavior: no users are migrated, no existing RLS policies are
-- altered. Founder/District Admin are PII-blind tiers; Site Admin/Teacher are
-- school-scoped. This is the foundation P3-P6 build on.
--
-- Apply to staging FIRST, run dual-role test cases, THEN prod.

-- ─── roles lookup ───────────────────────────────────────────────────────────
create table if not exists public.roles (
  name         text primary key,
  rank         smallint not null,
  is_pii_blind boolean not null default false
);

insert into public.roles (name, rank, is_pii_blind) values
  ('founder',        1, true),
  ('district_admin', 2, true),
  ('site_admin',     3, false),
  ('teacher',        4, false)
on conflict (name) do nothing;

-- ─── role_assignments ───────────────────────────────────────────────────────
-- school_id nullable: NULL = global role (founder, district_admin);
-- set = school-scoped role (site_admin, teacher).
create table if not exists public.role_assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null references public.roles(name),
  school_id  uuid references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, role, school_id)
);

create index if not exists role_assignments_user_idx
  on public.role_assignments using btree (user_id);
create index if not exists role_assignments_school_idx
  on public.role_assignments using btree (school_id);

alter table public.role_assignments enable row level security;

-- A user can see only their own role assignments.
drop policy if exists role_assignments_select_self on public.role_assignments;
create policy role_assignments_select_self
  on public.role_assignments
  for select
  using (user_id = auth.uid());

-- ─── has_role helper ────────────────────────────────────────────────────────
-- True if the current user holds p_role either globally (school_id IS NULL)
-- or at the specified school. RLS policies call this.
create or replace function public.has_role(p_role text, p_school_id uuid default null)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.role_assignments ra
    where ra.user_id = auth.uid()
      and ra.role = p_role

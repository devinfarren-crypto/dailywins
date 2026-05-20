-- Migration 011: school_admins table + is_school_admin() function
--
-- NOTE: This migration documents objects that ALREADY EXIST in production.
-- They were originally applied directly via the Supabase SQL editor and were
-- never captured as a numbered migration file. This file reconstructs them
-- EXACTLY as they exist in prod (pulled via pg_get_functiondef / catalog
-- inspection on 2026-05-20), using idempotent guards so it is safe to run
-- against a database that already has them (e.g. prod) AND against a fresh
-- database (e.g. the P1.5 staging branch).
--
-- Verified against prod project kvbpfvazddlmoxobqfev on 2026-05-20.

-- ─── Table ────────────────────────────────────────────────────────────────
create table if not exists public.school_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  school_id  uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (user_id, school_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
create index if not exists school_admins_user_id_idx
  on public.school_admins using btree (user_id);
create index if not exists school_admins_school_id_idx
  on public.school_admins using btree (school_id);

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.school_admins enable row level security;

-- A user can see only their own admin rows.
drop policy if exists school_admins_select_self on public.school_admins;
create policy school_admins_select_self
  on public.school_admins
  for select
  using (user_id = auth.uid());

-- ─── Function ───────────────────────────────────────────────────────────────
-- Returns true if the current authenticated user is an admin of target_school_id.
-- SECURITY DEFINER so it can read school_admins regardless of the caller's RLS.
create or replace function public.is_school_admin(target_school_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.school_admins
    where user_id = auth.uid()
      and school_id = target_school_id
  );
$function$;

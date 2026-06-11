-- Migration 048: async schedule-parse jobs
--
-- The bell-schedule AI parse can run 60–120s. Holding one HTTP request open
-- that long dies on VPNs / school proxies / flaky Wi-Fi (idle connections get
-- cut; the server finishes with 200 but the browser sees NetworkError — seen
-- live 2026-06-11, Vercel logs: 504 then 200s the client never received).
--
-- Fix: POST /api/schedule/parse now creates a row here and returns the job id
-- immediately; the parse continues server-side (next/server after()) and
-- writes its result/error to the row; the uploader polls a status endpoint
-- with quick cheap requests until the job lands.
--
-- Service-role only: RLS enabled, no policies. Rows are transient working
-- state (result is reviewed client-side then saved through the existing
-- schedule/save route) — old rows can be swept any time.
--
-- Rollback: drop table public.schedule_parse_jobs;

create table if not exists public.schedule_parse_jobs (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'working' check (status in ('working', 'done', 'error')),
  result       jsonb,
  error_code   text,
  error_detail text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists schedule_parse_jobs_creator_idx
  on public.schedule_parse_jobs (created_by, created_at desc);

alter table public.schedule_parse_jobs enable row level security;
-- no grants, no policies: service-role access only.

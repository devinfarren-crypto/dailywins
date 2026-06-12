-- Migration 053: The Locker — spine
--
-- Per docs/locker/* (plan) and docs/locker/decisions-2026-06-12.md:
--   - school-wide canonical student identity (unify-first decision)
--   - locker_identities: the combo slip + device-claim bookkeeping
--   - points_ledger: append-only bank, immutability enforced by trigger
--     (service-role included) — spending NEVER touches behavior_scores
--   - student_inventory + locker_layouts (JSONB, 30-item cap)
--   - locker_purchase(): atomic balance-check + spend + grant under an
--     advisory lock (no double-spend from racing tabs)
--
-- Access model: DailyWins-native (no Canvas/LTI). All locker traffic goes
-- through server routes using the service role; RLS is enabled with ZERO
-- policies on every locker table — browser credentials see nothing.
--
-- Rollback: drop function locker_purchase, locker_daily_earn_guard noted idx;
--   drop tables locker_layouts, student_inventory, points_ledger,
--   locker_identities; drop function canonical_student_id;
--   alter table students drop column canonical_id;

-- ── Canonical identity ───────────────────────────────────────────────────────
alter table public.students
  add column if not exists canonical_id uuid references public.students(id);

comment on column public.students.canonical_id is
  'School-wide identity unification: when the same kid exists on multiple rosters, duplicates point at one canonical row. NULL = this row is canonical.';

create or replace function public.canonical_student_id(p_student_id uuid)
  returns uuid language sql stable security definer set search_path to 'public'
as $$ select coalesce(canonical_id, id) from public.students where id = p_student_id $$;

-- ── Locker identities (the combo slip) ──────────────────────────────────────
create table if not exists public.locker_identities (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null unique references public.students(id) on delete cascade,
  teacher_id    uuid not null references public.teachers(id),  -- activating class
  combo         text not null,                                  -- '07-23-31'
  claim_secret  uuid not null default gen_random_uuid(),        -- cookie value; rotate to evict devices
  claimed_at    timestamptz,
  device_count  int not null default 0,
  created_at    timestamptz not null default now(),
  unique (teacher_id, combo)                                    -- combo identifies a student within the class
);

-- ── The bank: append-only ledger ─────────────────────────────────────────────
create table if not exists public.points_ledger (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  entry_type  text not null check (entry_type in ('earn','spend','adjustment','refund')),
  amount      integer not null check (amount <> 0),
  ref         jsonb not null default '{}'::jsonb,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists points_ledger_student_idx
  on public.points_ledger (student_id, created_at desc);

-- one earn row per student per teacher per day, no double-credit
create unique index if not exists points_ledger_daily_earn_guard
  on public.points_ledger (student_id, (ref->>'teacher_id'), (ref->>'date'))
  where ref->>'kind' = 'daily_earn';

-- Immutability: corrections are new rows, never edits — even for service role.
create or replace function public.points_ledger_immutable()
  returns trigger language plpgsql as $$
begin
  raise exception 'points_ledger is append-only (%). Write an adjustment or refund row instead.', tg_op;
end $$;

drop trigger if exists points_ledger_no_rewrite on public.points_ledger;
create trigger points_ledger_no_rewrite
  before update or delete on public.points_ledger
  for each row execute function public.points_ledger_immutable();

-- ── Inventory + layout ───────────────────────────────────────────────────────
create table if not exists public.student_inventory (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  item_id      text not null,
  acquired_via text not null check (acquired_via in ('starter','purchase','grant','welcome')),
  ledger_id    uuid references public.points_ledger(id),
  acquired_at  timestamptz not null default now(),
  unique (student_id, item_id)
);

create table if not exists public.locker_layouts (
  student_id  uuid primary key references public.students(id) on delete cascade,
  layout      jsonb not null default '{"items":[],"background":null}'::jsonb
              check (jsonb_array_length(layout->'items') <= 30),
  updated_at  timestamptz not null default now()
);

-- ── Atomic purchase ──────────────────────────────────────────────────────────
-- Price + catalog validation happen in the server route (catalog is a JSON
-- file in the app); this function guarantees the money math is atomic.
create or replace function public.locker_purchase(
  p_student_id uuid, p_item_id text, p_price int, p_catalog_version int
) returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v_balance int;
  v_ledger_id uuid;
begin
  if p_price <= 0 then raise exception 'invalid price'; end if;
  perform pg_advisory_xact_lock(hashtext(p_student_id::text));

  select coalesce(sum(amount), 0) into v_balance
  from public.points_ledger where student_id = p_student_id;
  if v_balance < p_price then
    return jsonb_build_object('ok', false, 'error', 'insufficient_funds', 'balance', v_balance);
  end if;
  if exists (select 1 from public.student_inventory
             where student_id = p_student_id and item_id = p_item_id) then
    return jsonb_build_object('ok', false, 'error', 'already_owned');
  end if;

  insert into public.points_ledger (student_id, entry_type, amount, ref)
  values (p_student_id, 'spend', -p_price,
          jsonb_build_object('kind','purchase','item_id',p_item_id,
                             'price',p_price,'catalog_version',p_catalog_version))
  returning id into v_ledger_id;

  insert into public.student_inventory (student_id, item_id, acquired_via, ledger_id)
  values (p_student_id, p_item_id, 'purchase', v_ledger_id);

  return jsonb_build_object('ok', true, 'balance', v_balance - p_price, 'ledger_id', v_ledger_id);
end $$;

-- ── RLS: enabled, zero policies — server-routes-only surface ────────────────
alter table public.locker_identities enable row level security;
alter table public.points_ledger     enable row level security;
alter table public.student_inventory enable row level security;
alter table public.locker_layouts    enable row level security;
-- no grants, no policies: service-role access only (the immutability trigger
-- still binds service role).

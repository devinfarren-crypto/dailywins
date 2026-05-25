-- Migration 018: invite-link system (P3, half A — account onboarding)
--
-- Built and tested on staging 2026-05-26. Single-use invite tokens, 14-day
-- expiry, stored HASHED (sha256) never raw. Tier-rank enforcement: a caller may
-- only invite a STRICTLY lower-ranked role (roles.rank). On redeem, creates the
-- role_assignment and marks the invite used (atomic, row-locked vs double-redeem).
-- Choices (2026-05-26): no email-locking (link-bearer redeems); any higher tier
-- may invite any lower tier.
--
-- Tested on staging: generate (site_admin→teacher) ok; token stored hashed;
-- validate peeks without consuming; redeem marks used + creates role; double-
-- redeem rejected; teacher cannot invite; same-rank invite rejected.
-- NOT yet applied to prod.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  role        text not null references public.roles(name),
  school_id   uuid references public.schools(id) on delete cascade,
  created_by  uuid not null references auth.users(id),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  used_at     timestamptz,
  used_by     uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists invites_token_hash_idx on public.invites using btree (token_hash);
create index if not exists invites_created_by_idx on public.invites using btree (created_by);

alter table public.invites enable row level security;
grant select on public.invites to authenticated;

create or replace function public.generate_invite(p_role text, p_school_id uuid default null)
  returns text language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_caller_min_rank smallint;
  v_target_rank     smallint;
  v_raw_token       text;
  v_token_hash      text;
begin
  select min(r.rank) into v_caller_min_rank
  from public.role_assignments ra join public.roles r on r.name = ra.role
  where ra.user_id = auth.uid();
  if v_caller_min_rank is null then raise exception 'No role: not permitted to invite'; end if;

  select rank into v_target_rank from public.roles where name = p_role;
  if v_target_rank is null then raise exception 'Unknown role: %', p_role; end if;
  if v_target_rank <= v_caller_min_rank then
    raise exception 'Not permitted to invite role % (rank %) from your tier (rank %)', p_role, v_target_rank, v_caller_min_rank;
  end if;

  v_raw_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  insert into public.invites (token_hash, role, school_id, created_by)
  values (v_token_hash, p_role, p_school_id, auth.uid());
  return v_raw_token;
end;
$function$;

create or replace function public.validate_invite(p_raw_token text)
  returns table(out_role text, out_school_id uuid, out_valid boolean, out_reason text)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_inv  public.invites;
begin
  select * into v_inv from public.invites where token_hash = v_hash;
  if not found then return query select null::text, null::uuid, false, 'not_found'; return; end if;
  if v_inv.used_at is not null then return query select v_inv.role, v_inv.school_id, false, 'already_used'; return; end if;
  if v_inv.expires_at < now() then return query select v_inv.role, v_inv.school_id, false, 'expired'; return; end if;
  return query select v_inv.role, v_inv.school_id, true, 'ok';
end;
$function$;

create or replace function public.redeem_invite(p_raw_token text)
  returns table(out_role text, out_school_id uuid)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_inv  public.invites;
begin
  select * into v_inv from public.invites where token_hash = v_hash for update;
  if not found then raise exception 'Invalid invite'; end if;
  if v_inv.used_at is not null then raise exception 'Invite already used'; end if;
  if v_inv.expires_at < now() then raise exception 'Invite expired'; end if;

  update public.invites set used_at = now(), used_by = auth.uid() where id = v_inv.id;
  insert into public.role_assignments (user_id, role, school_id, created_by)
  values (auth.uid(), v_inv.role, v_inv.school_id, v_inv.created_by)
  on conflict (user_id, role, school_id) do nothing;
  return query select v_inv.role, v_inv.school_id;
end;
$function$;

grant execute on function public.generate_invite(text, uuid) to authenticated;
grant execute on function public.validate_invite(text) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

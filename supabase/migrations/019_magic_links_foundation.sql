-- Migration 019: magic-link foundation (P3, half B)
--
-- Built + tested on staging 2026-05-26. The shared foundation for all three
-- magic-link types (parent / student / co_teacher), modeled as ONE table typed
-- by scope_type (Option A). Tokens stored HASHED (sha256, never raw). Multi-use
-- (unlike single-use invites). Every USE logged with IP + user_agent in a
-- separate audit table. Revoke path included (the gap deferred from 018 invites).
--
-- Access model: tables are RLS-locked with NO direct SELECT policy — ALL access
-- goes through the SECURITY DEFINER functions below (generate / validate / use /
-- revoke / list), consistent with the invites design. Only a teacher or
-- site_admin AT THE STUDENT'S SCHOOL may generate, list, or revoke a link.
--
-- Tested on staging: generate (teacher→parent link); multi-use logs each use
-- with distinct IP/UA (2 uses); list shows use_count; revoke works; revoked link
-- blocked from BOTH validate and use.
--
-- NOT INCLUDED YET (next migration): the per-scope DATA-READ functions that
-- return a student's scores/notes filtered for the link's scope (e.g. parent
-- view excludes private notes). use_magic_link only returns the scope; it does
-- not yet return student data.
-- NOT yet applied to prod.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.magic_links (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  scope_type  text not null check (scope_type in ('parent','student','co_teacher')),
  student_id  uuid references public.students(id) on delete cascade,
  access      text not null default 'read' check (access in ('read','readwrite')),
  created_by  uuid not null references auth.users(id),
  expires_at  timestamptz not null default (now() + interval '365 days'),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.magic_link_uses (
  id          uuid primary key default gen_random_uuid(),
  link_id     uuid not null references public.magic_links(id) on delete cascade,
  used_at     timestamptz not null default now(),
  ip          text,
  user_agent  text
);

create index if not exists magic_links_token_hash_idx on public.magic_links using btree (token_hash);
create index if not exists magic_links_student_idx on public.magic_links using btree (student_id);
create index if not exists magic_link_uses_link_idx on public.magic_link_uses using btree (link_id);

alter table public.magic_links enable row level security;
alter table public.magic_link_uses enable row level security;
grant select on public.magic_links, public.magic_link_uses to authenticated;

create or replace function public.generate_magic_link(p_scope_type text, p_student_id uuid, p_access text default 'read', p_expires_at timestamptz default (now() + interval '365 days'))
  returns text language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_student_school uuid;
  v_raw_token  text;
  v_token_hash text;
begin
  if p_scope_type not in ('parent','student','co_teacher') then raise exception 'Invalid scope_type: %', p_scope_type; end if;
  v_student_school := public.student_school_id(p_student_id);
  if v_student_school is null then raise exception 'Unknown student'; end if;
  if not (public.has_role('teacher', v_student_school) or public.has_role('site_admin', v_student_school)) then
    raise exception 'Not permitted to create a link for this student';
  end if;
  v_raw_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  insert into public.magic_links (token_hash, scope_type, student_id, access, created_by, expires_at)
  values (v_token_hash, p_scope_type, p_student_id, p_access, auth.uid(), p_expires_at);
  return v_raw_token;
end;
$function$;

create or replace function public.validate_magic_link(p_raw_token text)
  returns table(out_scope_type text, out_student_id uuid, out_access text, out_valid boolean, out_reason text)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml   public.magic_links;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then return query select null::text, null::uuid, null::text, false, 'not_found'; return; end if;
  if v_ml.revoked_at is not null then return query select v_ml.scope_type, v_ml.student_id, v_ml.access, false, 'revoked'; return; end if;
  if v_ml.expires_at < now() then return query select v_ml.scope_type, v_ml.student_id, v_ml.access, false, 'expired'; return; end if;
  return query select v_ml.scope_type, v_ml.student_id, v_ml.access, true, 'ok';
end;
$function$;

create or replace function public.use_magic_link(p_raw_token text, p_ip text default null, p_user_agent text default null)
  returns table(out_scope_type text, out_student_id uuid, out_access text)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml   public.magic_links;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  return query select v_ml.scope_type, v_ml.student_id, v_ml.access;
end;
$function$;

create or replace function public.revoke_magic_link(p_link_id uuid)
  returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_ml public.magic_links;
  v_school uuid;
begin
  select * into v_ml from public.magic_links where id = p_link_id;
  if not found then raise exception 'Link not found'; end if;
  v_school := public.student_school_id(v_ml.student_id);
  if not (public.has_role('teacher', v_school) or public.has_role('site_admin', v_school)) then
    raise exception 'Not permitted to revoke this link';
  end if;
  update public.magic_links set revoked_at = now() where id = p_link_id and revoked_at is null;
  return true;
end;
$function$;

create or replace function public.list_magic_links(p_student_id uuid)
  returns table(id uuid, scope_type text, access text, expires_at timestamptz, revoked_at timestamptz, created_at timestamptz, use_count bigint)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_school uuid := public.student_school_id(p_student_id);
begin
  if not (public.has_role('teacher', v_school) or public.has_role('site_admin', v_school)) then
    raise exception 'Not permitted to view links for this student';
  end if;
  return query
    select ml.id, ml.scope_type, ml.access, ml.expires_at, ml.revoked_at, ml.created_at,
           (select count(*) from public.magic_link_uses u where u.link_id = ml.id) as use_count
    from public.magic_links ml where ml.student_id = p_student_id order by ml.created_at desc;
end;
$function$;

grant execute on function public.generate_magic_link(text, uuid, text, timestamptz) to authenticated;
grant execute on function public.validate_magic_link(text) to authenticated;
grant execute on function public.use_magic_link(text, text, text) to authenticated;
grant execute on function public.revoke_magic_link(uuid) to authenticated;
grant execute on function public.list_magic_links(uuid) to authenticated;

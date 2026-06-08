-- 037_email_bound_teacher_invites.sql
-- Simplify teacher invites: bind an invite to an EMAIL instead of carrying a
-- token through the URL (which broke — the magic-link email template rebuilds
-- the URL as /auth/confirm?token_hash=… and drops the ?invite= param, so invited
-- teachers fell through to a brand-new pending signup).
--
-- New model: a site admin creates an invite bound to the teacher's email. When
-- anyone signs in with that email (Google or magic-link — Supabase has verified
-- they control it), they're auto-provisioned as a teacher. No URL token.

-- Email the invite is bound to (null = legacy link-bearer invite).
alter table public.invites add column if not exists email text;
create index if not exists invites_email_idx on public.invites (lower(email)) where email is not null;

-- Create an email-bound teacher invite. Founder or the school's site admin only.
-- token_hash is still required/unique on the table, so we store a random one even
-- though redemption is by email, not by token.
create or replace function public.create_teacher_invite(p_school_id uuid, p_email text)
  returns uuid language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_token_hash text;
  v_id uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'email is required';
  end if;
  if not (has_role('founder') or has_role('site_admin', p_school_id)) then
    raise exception 'not authorized to invite teachers at this school'
      using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.schools where id = p_school_id) then
    raise exception 'school does not exist';
  end if;

  v_token_hash := encode(
    extensions.digest(encode(extensions.gen_random_bytes(32), 'hex'), 'sha256'), 'hex');

  insert into public.invites (token_hash, role, school_id, email, created_by)
  values (v_token_hash, 'teacher', p_school_id, lower(trim(p_email)), auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.create_teacher_invite(uuid, text) from public, anon;
grant execute on function public.create_teacher_invite(uuid, text) to authenticated;

-- Claim an email-bound teacher invite for a freshly authenticated user. Matches
-- the invite's email to the user's VERIFIED auth email, then provisions teacher
-- (role + teachers row) and marks the invite used. Service-role only — called
-- from the post-auth redirect resolver.
create or replace function public.claim_email_teacher_invite(p_user_id uuid)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_email text;
  v_name  text;
  v_inv   public.invites;
begin
  select email,
         coalesce(raw_user_meta_data->>'full_name',
                  raw_user_meta_data->>'name',
                  split_part(email, '@', 1))
    into v_email, v_name
  from auth.users where id = p_user_id;

  if v_email is null then
    return jsonb_build_object('claimed', false);
  end if;

  select * into v_inv from public.invites
  where lower(email) = lower(v_email)
    and role = 'teacher'
    and used_at is null
    and expires_at > now()
  order by created_at
  limit 1
  for update;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  if not exists (select 1 from public.teachers where auth_id = p_user_id) then
    insert into public.teachers (auth_id, school_id, full_name, email)
    values (p_user_id, v_inv.school_id, v_name, v_email);
  end if;

  insert into public.role_assignments (user_id, role, school_id, created_by)
  values (p_user_id, 'teacher', v_inv.school_id, v_inv.created_by)
  on conflict (user_id, role, school_id) do nothing;

  update public.invites set used_at = now(), used_by = p_user_id where id = v_inv.id;

  return jsonb_build_object('claimed', true, 'school_id', v_inv.school_id);
end;
$function$;

revoke all on function public.claim_email_teacher_invite(uuid) from public, anon, authenticated;
grant execute on function public.claim_email_teacher_invite(uuid) to service_role;

-- 036_teacher_invite_and_deactivate.sql
-- Site Admin can invite + deactivate teachers (docs/TIERED_ARCHITECTURE_v1.1).
--
-- 1) teachers.deactivated_at — "deactivate, don't delete": blocks login + drops
--    the teacher from rosters, but preserves all historical data. Reversible.
-- 2) redeem_invite now fully provisions a TEACHER invite (role_assignment + a
--    teachers row), so an invited teacher lands on a working dashboard instead of
--    bouncing to /pending via ensure_teacher_exists. Other roles unchanged.
-- 3) set_teacher_active(teacher, active) — founder or the teacher's site_admin
--    toggles deactivation. SECURITY DEFINER, scope-checked.

-- ── 1. Deactivation column ──
alter table public.teachers add column if not exists deactivated_at timestamptz;

-- ── 2. Full provisioning on teacher invite redeem ──
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

  -- A teacher needs a teachers row to use the dashboard. Provision it from the
  -- invitee's auth profile (no access_request exists for an invited teacher).
  if v_inv.role = 'teacher' and v_inv.school_id is not null
     and not exists (select 1 from public.teachers where auth_id = auth.uid()) then
    insert into public.teachers (auth_id, school_id, full_name, email)
    select auth.uid(), v_inv.school_id,
           coalesce(u.raw_user_meta_data->>'full_name',
                    u.raw_user_meta_data->>'name',
                    split_part(u.email, '@', 1)),
           u.email
    from auth.users u where u.id = auth.uid();
  end if;

  return query select v_inv.role, v_inv.school_id;
end;
$function$;

-- ── 3. Activate / deactivate a teacher ──
create or replace function public.set_teacher_active(p_teacher_id uuid, p_active boolean)
  returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_school uuid;
begin
  select school_id into v_school from public.teachers where id = p_teacher_id;
  if v_school is null then
    raise exception 'teacher % not found', p_teacher_id;
  end if;
  if not (has_role('founder') or has_role('site_admin', v_school)) then
    raise exception 'not authorized to manage teachers at this school'
      using errcode = 'insufficient_privilege';
  end if;

  update public.teachers
  set deactivated_at = case when p_active then null else now() end
  where id = p_teacher_id;

  return true;
end;
$function$;

revoke all on function public.set_teacher_active(uuid, boolean) from public, anon;
grant execute on function public.set_teacher_active(uuid, boolean) to authenticated;

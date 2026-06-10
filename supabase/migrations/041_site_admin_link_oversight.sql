-- Migration 041: site-admin magic-link oversight (list + audited revoke)
--
-- The tier doc's "compliance backstop": a site admin can see every active
-- family/co-teacher link at their school and kill any of them. Two pieces:
--
-- 1) list_school_magic_links(p_school_id) — school-wide link list for site
--    admins (their school) and founders. PII-BLIND by design (migration 035):
--    returns link metadata + the CREATING TEACHER's name only — no student
--    names or ids. Site admins already see the teacher roster, so the teacher
--    name leaks nothing new; identifying a link is "Ms. X's parent link from
--    May 3," which is enough to act on ("teacher left → revoke their links").
--
-- 2) revoke_magic_link — same checks as 019 (verified against prod before
--    this rewrite) plus: founders may also revoke, and a successful revoke now
--    writes an audit_log row ('magic_link.revoke', actor = auth.uid()) so the
--    compliance action is itself part of the compliance record.
--
-- Rollback: .snapshots/041-pre-link-oversight.sql

create or replace function public.list_school_magic_links(p_school_id uuid)
  returns table(
    id           uuid,
    scope_type   text,
    access       text,
    created_at   timestamptz,
    expires_at   timestamptz,
    revoked_at   timestamptz,
    use_count    bigint,
    last_used_at timestamptz,
    teacher_name text
  )
  language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not (public.has_role('site_admin', p_school_id) or public.has_role('founder')) then
    raise exception 'Not permitted to list links for this school';
  end if;
  return query
    select ml.id, ml.scope_type, ml.access, ml.created_at, ml.expires_at, ml.revoked_at,
           (select count(*) from public.magic_link_uses u where u.link_id = ml.id)    as use_count,
           (select max(u.used_at) from public.magic_link_uses u where u.link_id = ml.id) as last_used_at,
           coalesce(t.full_name, 'Unknown teacher')                                   as teacher_name
    from public.magic_links ml
    join public.students s on s.id = ml.student_id
    left join public.teachers t on t.auth_id = ml.created_by
    where s.school_id = p_school_id
    order by (ml.revoked_at is null and ml.expires_at > now()) desc, ml.created_at desc;
end;
$function$;

grant execute on function public.list_school_magic_links(uuid) to authenticated;

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
  if not (public.has_role('teacher', v_school) or public.has_role('site_admin', v_school)
          or public.has_role('founder')) then
    raise exception 'Not permitted to revoke this link';
  end if;
  update public.magic_links set revoked_at = now() where id = p_link_id and revoked_at is null;
  if found then
    insert into public.audit_log (actor_user_id, action, target_table, target_id, before, after)
    values (
      auth.uid(), 'magic_link.revoke', 'magic_links', p_link_id,
      jsonb_build_object('scope_type', v_ml.scope_type, 'access', v_ml.access,
                         'expires_at', v_ml.expires_at, 'revoked_at', null),
      jsonb_build_object('revoked_at', now())
    );
  end if;
  return true;
end;
$function$;

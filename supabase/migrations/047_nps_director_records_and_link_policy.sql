-- Migration 047: NPS director records access + school link policy
--
-- The NPS director login (FIELD-GUIDE shapes): at an org_type='nps' school the
-- director has FULL visibility — all points, all notes (shared and private) —
-- and complete control over whether magic links exist at their school at all.
-- District-shaped orgs are untouched: their site admins remain PII-blind (035).
--
-- 1) is_nps_school_admin(school): the gate. site_admin at the school OR
--    district_admin over its org, AND the org is org_type='nps'. Founders are
--    deliberately NOT included — operator blindness (/privacy §7.3) holds;
--    Devin tests via an NPS-director test account or audited act-as.
-- 2) nps_list_school_students / nps_get_student_record: roster + full record
--    (scores in the 038 chart shape, dominant-teacher categories, ALL notes
--    with teacher attribution). Record opens write an audit row
--    ('nps_record.student') — no reason required (this is the director's
--    routine oversight, unlike the district notes archive), but the trail
--    exists.
-- 3) schools.link_settings jsonb {parent,student,co_teacher} — the director's
--    "complete control" over magic links. ENFORCED inside generate_magic_link
--    (a teacher cannot generate a disabled type no matter what the UI shows),
--    surfaced via get_/set_school_link_settings (set = site_admin of that
--    school or founder, audited with before/after).
--
-- Rollback: drop functions nps_list_school_students, nps_get_student_record,
--   is_nps_school_admin, get_school_link_settings, set_school_link_settings;
--   restore generate_magic_link from 019; alter table schools drop column link_settings;

alter table public.schools
  add column if not exists link_settings jsonb not null
  default '{"parent": true, "student": true, "co_teacher": true}'::jsonb;

comment on column public.schools.link_settings is
  'Per-type magic-link policy ({parent,student,co_teacher}: bool). Enforced inside generate_magic_link; managed by the school''s site admin (NPS: the director) via set_school_link_settings.';

create or replace function public.is_nps_school_admin(p_school_id uuid)
  returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.schools s
    join public.districts d on d.id = s.district_id
    where s.id = p_school_id
      and d.org_type = 'nps'
      and (
        exists (select 1 from public.role_assignments ra
                where ra.user_id = auth.uid() and ra.role = 'site_admin' and ra.school_id = s.id)
        or exists (select 1 from public.role_assignments ra
                   where ra.user_id = auth.uid() and ra.role = 'district_admin' and ra.district_id = d.id)
      )
  );
$function$;

create or replace function public.nps_list_school_students(p_school_id uuid)
  returns table(
    id uuid,
    display_name text,
    teacher_names text,
    last_score_date date,
    scores_30d bigint,
    notes_count bigint
  )
  language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_nps_school_admin(p_school_id) then
    raise exception 'Not permitted: NPS director access required for this school';
  end if;
  return query
    select st.id,
           coalesce(nullif(trim(st.display_name), ''), trim(st.first_name || ' ' || st.last_name)) as display_name,
           (select string_agg(distinct t.full_name, ', ')
              from public.behavior_scores bs join public.teachers t on t.id = bs.teacher_id
              where bs.student_id = st.id) as teacher_names,
           (select max(bs.score_date) from public.behavior_scores bs where bs.student_id = st.id) as last_score_date,
           (select count(*) from public.behavior_scores bs
              where bs.student_id = st.id and bs.score_date >= current_date - 30) as scores_30d,
           (select count(*) from public.notes n where n.student_id = st.id) as notes_count
    from public.students st
    where st.school_id = p_school_id
    order by 2;
end;
$function$;

create or replace function public.nps_get_student_record(p_student_id uuid)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_school uuid := public.student_school_id(p_student_id);
  v_result jsonb;
begin
  if v_school is null then raise exception 'Unknown student'; end if;
  if not public.is_nps_school_admin(v_school) then
    raise exception 'Not permitted: NPS director access required for this school';
  end if;

  insert into public.audit_log (actor_user_id, action, target_table, target_id)
  values (auth.uid(), 'nps_record.student', 'students', p_student_id);

  select jsonb_build_object(
    'student', (select jsonb_build_object(
        'id', s.id,
        'display_name', coalesce(nullif(trim(s.display_name), ''), trim(s.first_name || ' ' || s.last_name))
      ) from public.students s where s.id = p_student_id),
    -- Chart categories: the dominant (most recent) scoring teacher's set, same
    -- convention as the 038 magic-link views.
    'categories', coalesce((
      select t.categories from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = p_student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '[]'::jsonb),
    'scores', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', bs.id, 'score_date', bs.score_date, 'period', bs.period, 'scores', bs.scores,
        'arrival', bs.arrival, 'compliance', bs.compliance, 'social', bs.social,
        'on_task', bs.on_task, 'phone_away', bs.phone_away
      ) order by bs.score_date, bs.period), '[]'::jsonb)
      from public.behavior_scores bs where bs.student_id = p_student_id),
    -- ALL notes — shared AND private — with teacher attribution. The director
    -- owns the school's record (same rationale as the district notes archive).
    'notes', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'note_date', n.note_date, 'period', n.period, 'content', n.content,
        'is_private', n.is_private,
        'teacher_name', (select t.full_name from public.teachers t where t.id = n.teacher_id)
      ) order by n.note_date desc, n.created_at desc), '[]'::jsonb)
      from public.notes n where n.student_id = p_student_id)
  ) into v_result;

  return v_result;
end;
$function$;

grant execute on function public.is_nps_school_admin(uuid) to authenticated;
grant execute on function public.nps_list_school_students(uuid) to authenticated;
grant execute on function public.nps_get_student_record(uuid) to authenticated;

-- ── Link policy ─────────────────────────────────────────────────────────────

create or replace function public.get_school_link_settings(p_school_id uuid)
  returns jsonb language sql stable security definer set search_path to 'public'
as $function$
  select coalesce(s.link_settings, '{"parent": true, "student": true, "co_teacher": true}'::jsonb)
  from public.schools s where s.id = p_school_id;
$function$;

create or replace function public.set_school_link_settings(p_school_id uuid, p_settings jsonb)
  returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_before jsonb;
  v_clean  jsonb;
begin
  if not (public.has_role('site_admin', p_school_id) or public.has_role('founder')) then
    raise exception 'Not permitted to change link settings for this school';
  end if;
  -- Only the three known keys, coerced to booleans; anything else is dropped.
  v_clean := jsonb_build_object(
    'parent',     coalesce((p_settings->>'parent')::boolean, true),
    'student',    coalesce((p_settings->>'student')::boolean, true),
    'co_teacher', coalesce((p_settings->>'co_teacher')::boolean, true)
  );
  select link_settings into v_before from public.schools where id = p_school_id;
  if not found then raise exception 'Unknown school'; end if;

  update public.schools set link_settings = v_clean where id = p_school_id;

  insert into public.audit_log (actor_user_id, action, target_table, target_id, before, after)
  values (auth.uid(), 'school.link_settings', 'schools', p_school_id, v_before, v_clean);

  return v_clean;
end;
$function$;

grant execute on function public.get_school_link_settings(uuid) to authenticated;
grant execute on function public.set_school_link_settings(uuid, jsonb) to authenticated;

-- generate_magic_link: same body as 019 plus the link-policy enforcement —
-- the DB is the guarantee, the UI merely reflects it.
create or replace function public.generate_magic_link(p_scope_type text, p_student_id uuid, p_access text default 'read', p_expires_at timestamptz default (now() + interval '365 days'))
  returns text language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_student_school uuid;
  v_settings   jsonb;
  v_raw_token  text;
  v_token_hash text;
begin
  if p_scope_type not in ('parent','student','co_teacher') then raise exception 'Invalid scope_type: %', p_scope_type; end if;
  v_student_school := public.student_school_id(p_student_id);
  if v_student_school is null then raise exception 'Unknown student'; end if;
  if not (public.has_role('teacher', v_student_school) or public.has_role('site_admin', v_student_school)) then
    raise exception 'Not permitted to create a link for this student';
  end if;
  select coalesce(s.link_settings, '{}'::jsonb) into v_settings from public.schools s where s.id = v_student_school;
  if not coalesce((v_settings->>p_scope_type)::boolean, true) then
    raise exception 'This link type is turned off by your school administrator';
  end if;
  v_raw_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  insert into public.magic_links (token_hash, scope_type, student_id, access, created_by, expires_at)
  values (v_token_hash, p_scope_type, p_student_id, p_access, auth.uid(), p_expires_at);
  return v_raw_token;
end;
$function$;

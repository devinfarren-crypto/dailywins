-- Migration 040: surface the teacher's progress icon in the magic-link views
--
-- For fun continuity, the parent/student/co-teacher pages echo the teacher's
-- chosen progress icon (⭐ / 🏆 / 🎯, stored in teachers.preferences.starIcon).
-- Adds a `progress_icon` field to each view, sourced from the same teacher whose
-- categories the view already uses (most recent scorer of this student), default
-- ⭐. Purely additive; all existing fields, the private-note rule, and the scope
-- guards are unchanged from 038.

create or replace function public.get_parent_view(p_raw_token text, p_ip text default null, p_user_agent text default null)
  returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_result jsonb;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'parent' then raise exception 'Not a parent link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  select jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name) from public.students s where s.id = v_ml.student_id),
    'categories', coalesce((
      select t.categories from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '[]'::jsonb),
    'progress_icon', coalesce((
      select t.preferences->>'starIcon' from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '⭐'),
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object(
        'id', bs.id, 'score_date', bs.score_date, 'period', bs.period, 'scores', bs.scores,
        'arrival', bs.arrival, 'compliance', bs.compliance, 'social', bs.social,
        'on_task', bs.on_task, 'phone_away', bs.phone_away
      ) order by bs.score_date, bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
    'notes',   (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content) order by n.id), '[]'::jsonb) from public.notes n where n.student_id = v_ml.student_id and n.is_private = false)
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.get_student_view(p_raw_token text, p_ip text default null, p_user_agent text default null)
  returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_result jsonb;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'student' then raise exception 'Not a student link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  select jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name) from public.students s where s.id = v_ml.student_id),
    'categories', coalesce((
      select t.categories from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '[]'::jsonb),
    'progress_icon', coalesce((
      select t.preferences->>'starIcon' from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '⭐'),
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object(
        'id', bs.id, 'score_date', bs.score_date, 'period', bs.period, 'scores', bs.scores,
        'arrival', bs.arrival, 'compliance', bs.compliance, 'social', bs.social,
        'on_task', bs.on_task, 'phone_away', bs.phone_away
      ) order by bs.score_date, bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
    'notes',   (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content) order by n.id), '[]'::jsonb) from public.notes n where n.student_id = v_ml.student_id and n.is_private = false)
  ) into v_result;
  return v_result;
end;
$function$;

create or replace function public.get_coteacher_view(p_raw_token text, p_ip text default null, p_user_agent text default null)
  returns jsonb language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_result jsonb;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'co_teacher' then raise exception 'Not a co-teacher link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  select jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name) from public.students s where s.id = v_ml.student_id),
    'access',  v_ml.access,
    'categories', coalesce((
      select t.categories from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '[]'::jsonb),
    'progress_icon', coalesce((
      select t.preferences->>'starIcon' from public.teachers t
      where t.id = (
        select bs2.teacher_id from public.behavior_scores bs2
        where bs2.student_id = v_ml.student_id
        order by bs2.score_date desc, bs2.created_at desc limit 1
      )
    ), '⭐'),
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object(
        'id', bs.id, 'score_date', bs.score_date, 'period', bs.period, 'scores', bs.scores,
        'arrival', bs.arrival, 'compliance', bs.compliance, 'social', bs.social,
        'on_task', bs.on_task, 'phone_away', bs.phone_away
      ) order by bs.score_date, bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
    'notes',   (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content) order by n.id), '[]'::jsonb) from public.notes n where n.student_id = v_ml.student_id and n.is_private = false)
  ) into v_result;
  return v_result;
end;
$function$;

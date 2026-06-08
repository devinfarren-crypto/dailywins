-- Migration 038: dated scores + category config for the magic-link views
--
-- The parent / student / co-teacher read views (migration 020) returned each
-- score as { id, period, scores } — no date and no category metadata. That was
-- only enough to render one cumulative number per period, which tells a parent
-- nothing. To render daily/weekly/monthly behavior charts we need:
--   * score_date on every row (the time axis), plus the legacy per-category
--     columns so pre-jsonb rows still chart (mirrors ChartViews.extractScores).
--   * the teacher's `categories` config (id, name, maxPoints, ...) so raw points
--     become a real percentage AND custom category labels (e.g. a teacher who
--     renamed them to Empathy / Organization / Timeliness) flow through to the
--     chart legend unchanged.
--
-- categories source: the teacher who most RECENTLY scored this student. That row
-- is guaranteed to use the same category ids the scores are keyed by, so labels
-- and maxPoints always line up with the data. Falls back to [] (the client then
-- uses its built-in defaults) when the student has no scores yet.
--
-- Pure additive change: existing fields are untouched, so already-deployed
-- callers that ignore the new keys keep working. The ABSOLUTE PRIVATE-NOTE rule
-- (is_private = false only) and the per-function scope guards are preserved
-- exactly as in 020.

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

-- Migration 020: magic-link data-read layer (P3, half B)
--
-- The per-scope view functions that sit on top of the 019 foundation. Each
-- validates its token, confirms the token's scope_type matches the function,
-- logs the use (IP/UA), and returns a jsonb bundle of the student's data.
--
-- ABSOLUTE PRIVACY RULE (matches P2, confirmed 2026-05-26): a private note is
-- visible ONLY to its author. NO role, NO link type sees it — not parents, not
-- students, not co-teachers. All three views filter notes with is_private=false.
-- To share an observation, the teacher makes it a non-private note (a deliberate
-- act). This keeps the rule absolute with zero exceptions.
--
-- Scope guard: each function rejects a token whose scope_type doesn't match
-- (e.g. a co_teacher token is refused by get_parent_view), so a token can't be
-- repurposed to a different access level.
--
-- Tested on staging: parent view returns scores + shared note, EXCLUDES private
-- note (verified with a real private note present); use logged with IP/UA;
-- co_teacher view returns access=readwrite + same non-private filter; scope guard
-- rejects cross-type token use.
--
-- co_teacher WRITE path (actually writing scores/notes via a readwrite link) is
-- NOT built yet — these are read views. Write path is a later increment.
-- NOT yet applied to prod.

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
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object('id', bs.id, 'period', bs.period, 'scores', bs.scores) order by bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
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
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object('id', bs.id, 'period', bs.period, 'scores', bs.scores) order by bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
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
    'scores',  (select coalesce(jsonb_agg(jsonb_build_object('id', bs.id, 'period', bs.period, 'scores', bs.scores) order by bs.period), '[]'::jsonb) from public.behavior_scores bs where bs.student_id = v_ml.student_id),
    'notes',   (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'content', n.content) order by n.id), '[]'::jsonb) from public.notes n where n.student_id = v_ml.student_id and n.is_private = false)
  ) into v_result;
  return v_result;
end;
$function$;

grant execute on function public.get_parent_view(text, text, text) to authenticated;
grant execute on function public.get_student_view(text, text, text) to authenticated;
grant execute on function public.get_coteacher_view(text, text, text) to authenticated;

-- Migration 021: co-teacher write path (P3, half B — completes magic links)
--
-- Lets a co-teacher WRITE scores and notes through a readwrite co-teacher link.
-- Built + tested on staging 2026-05-26. Decision (2026-05-26): co-teachers write
-- SHARED content only — they CANNOT create private notes (is_private hardcoded
-- false). A co-teacher has no auth account; writes are attributed to the LEAD
-- teacher (the link's created_by → their teachers.id). Since co-teacher notes are
-- always shared, this attribution is honest (shared notes are collective) and
-- preserves the absolute rule that private notes only ever come from a logged-in
-- author. Both functions require access='readwrite' (read-only links rejected).
--
-- Tested on staging: write score + note via readwrite link (attributed to lead
-- teacher, note is_private=false); read-only co-teacher link rejected from writing.
-- NOT yet applied to prod.

create or replace function public.coteacher_write_score(p_raw_token text, p_period int, p_scores jsonb, p_ip text default null, p_user_agent text default null)
  returns uuid language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_teacher_id uuid;
  v_new_id uuid;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'co_teacher' then raise exception 'Not a co-teacher link'; end if;
  if v_ml.access <> 'readwrite' then raise exception 'Link is read-only'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  select id into v_teacher_id from public.teachers where auth_id = v_ml.created_by;
  if v_teacher_id is null then raise exception 'Link creator is not a teacher'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  insert into public.behavior_scores (student_id, teacher_id, period, scores)
  values (v_ml.student_id, v_teacher_id, p_period, p_scores) returning id into v_new_id;
  return v_new_id;
end;
$function$;

create or replace function public.coteacher_write_note(p_raw_token text, p_content text, p_ip text default null, p_user_agent text default null)
  returns uuid language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_teacher_id uuid;
  v_new_id uuid;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'co_teacher' then raise exception 'Not a co-teacher link'; end if;
  if v_ml.access <> 'readwrite' then raise exception 'Link is read-only'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  select id into v_teacher_id from public.teachers where auth_id = v_ml.created_by;
  if v_teacher_id is null then raise exception 'Link creator is not a teacher'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  -- is_private hardcoded false: co-teachers can ONLY write shared notes
  insert into public.notes (student_id, teacher_id, is_private, content)
  values (v_ml.student_id, v_teacher_id, false, p_content) returning id into v_new_id;
  return v_new_id;
end;
$function$;

grant execute on function public.coteacher_write_score(text, int, jsonb, text, text) to authenticated;
grant execute on function public.coteacher_write_note(text, text, text, text) to authenticated;

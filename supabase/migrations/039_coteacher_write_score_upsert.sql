-- Migration 039: co-teacher score write becomes an UPSERT
--
-- coteacher_write_score (021) was a plain INSERT, but behavior_scores has a
-- UNIQUE (student_id, teacher_id, score_date, period) constraint and score_date
-- defaults to today. So a co-teacher writing a period the lead teacher (or they)
-- already scored today hit a unique violation — "shared scoring" couldn't
-- actually share a row. Now it upserts on that key.
--
-- The DO UPDATE MERGES per-key (`existing || submitted`) rather than replacing
-- the whole blob, so a co-teacher submitting one category doesn't wipe the
-- categories the lead teacher already set for that period. (The dashboard's own
-- save is a separate PostgREST upsert that always sends a complete blob, so it's
-- unaffected.) Every token / scope / access / revoked / expiry guard and the
-- lead-teacher attribution are preserved exactly as in 021.

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
  values (v_ml.student_id, v_teacher_id, p_period, p_scores)
  on conflict (student_id, teacher_id, score_date, period)
  do update set scores = coalesce(public.behavior_scores.scores, '{}'::jsonb) || excluded.scores, updated_at = now()
  returning id into v_new_id;
  return v_new_id;
end;
$function$;

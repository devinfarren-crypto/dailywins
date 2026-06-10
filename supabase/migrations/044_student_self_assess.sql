-- Migration 044: student self-assessment via the student magic link
--
-- Teachers can hand students a SELF-ASSESS option: generate the student link
-- with access='readwrite' (the existing magic-link access field — no new
-- plumbing) and the student view grows a rating panel. Self-assessments are
-- stored in their OWN table, never in behavior_scores — the teacher's record
-- stays the official one, which is what "the teacher can override" means
-- structurally: the student's voice is captured alongside, not on top.
--
--   - self_assessments: one row per (student, teacher, date, period); scores
--     jsonb uses the dashboard's exact encoding (option INDEX for arrival,
--     points otherwise). Re-submitting a period the same day merges per-key.
--   - student_self_assess RPC (anon): token-validated (student scope,
--     readwrite, unexpired, unrevoked), attributed to the link's creating
--     teacher, use-logged like every magic-link call.
--   - get_self_assessments RPC (anon): the link's recent self-assessments
--     (14 days) so the student page can show what was submitted.
--   - RLS: teachers read their own students' self-assessments (act-as aware
--     via effective_user_id); no other direct access.
--
-- Rollback: drop function public.get_self_assessments(text);
--           drop function public.student_self_assess(text, int, jsonb, text, text);
--           drop table public.self_assessments;

create table if not exists public.self_assessments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  assess_date date not null default current_date,
  period      int not null,
  scores      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (student_id, teacher_id, assess_date, period)
);

create index if not exists self_assessments_student_idx
  on public.self_assessments (student_id, assess_date desc);

alter table public.self_assessments enable row level security;
grant select on public.self_assessments to authenticated;

drop policy if exists self_assessments_teacher_read on public.self_assessments;
create policy self_assessments_teacher_read
  on public.self_assessments for select
  using (
    exists (
      select 1 from public.teachers t
      where t.id = self_assessments.teacher_id
        and t.auth_id = public.effective_user_id()
    )
  );

create or replace function public.student_self_assess(
  p_raw_token text, p_period int, p_scores jsonb,
  p_ip text default null, p_user_agent text default null
)
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
  if v_ml.scope_type <> 'student' then raise exception 'Not a student link'; end if;
  if v_ml.access <> 'readwrite' then raise exception 'Self-assessment is not enabled on this link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  if p_period is null or p_period < 0 or p_period > 8 then raise exception 'Invalid period'; end if;
  select id into v_teacher_id from public.teachers where auth_id = v_ml.created_by;
  if v_teacher_id is null then raise exception 'Link creator is not a teacher'; end if;
  insert into public.magic_link_uses (link_id, ip, user_agent) values (v_ml.id, p_ip, p_user_agent);
  insert into public.self_assessments (student_id, teacher_id, period, scores)
  values (v_ml.student_id, v_teacher_id, p_period, p_scores)
  on conflict (student_id, teacher_id, assess_date, period)
  do update set scores = coalesce(public.self_assessments.scores, '{}'::jsonb) || excluded.scores,
                updated_at = now()
  returning id into v_new_id;
  return v_new_id;
end;
$function$;

create or replace function public.get_self_assessments(p_raw_token text)
  returns table(assess_date date, period int, scores jsonb)
  language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');
  v_ml public.magic_links;
  v_teacher_id uuid;
begin
  select * into v_ml from public.magic_links where token_hash = v_hash;
  if not found then raise exception 'Invalid link'; end if;
  if v_ml.scope_type <> 'student' then raise exception 'Not a student link'; end if;
  if v_ml.revoked_at is not null then raise exception 'Link revoked'; end if;
  if v_ml.expires_at < now() then raise exception 'Link expired'; end if;
  select id into v_teacher_id from public.teachers where auth_id = v_ml.created_by;
  return query
    select sa.assess_date, sa.period, sa.scores
    from public.self_assessments sa
    where sa.student_id = v_ml.student_id
      and sa.teacher_id = v_teacher_id
      and sa.assess_date >= current_date - 14
    order by sa.assess_date desc, sa.period;
end;
$function$;

grant execute on function public.student_self_assess(text, int, jsonb, text, text) to anon, authenticated;
grant execute on function public.get_self_assessments(text) to anon, authenticated;

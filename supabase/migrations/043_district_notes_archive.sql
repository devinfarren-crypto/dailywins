-- Migration 043: district notes archive — audited, reason-required record access
--
-- Districts that buy the platform own the educational record on it; teacher
-- notes are discoverable documents (records requests, due process, subpoenas).
-- This gives district admins (and founders) access to ALL notes in their
-- district — including private ones — but as a deliberate records action,
-- not ambient browsing:
--
--   - a specific reason (>= 10 chars) is REQUIRED, or the function raises
--   - the access itself is written to audit_log ('notes.archive_access',
--     with the reason and district scope) BEFORE any rows are returned
--   - scope is the caller's district(s); founders may target any district
--
-- This is a deliberate, documented exception to the admin PII-blind posture
-- (035): records-custodian access, visible in the audit log that district
-- admins themselves can read (scoped audit-read). /privacy is updated in the
-- same commit.
--
-- Rollback: drop function public.district_notes_archive(text, uuid);

create or replace function public.district_notes_archive(p_reason text, p_district_id uuid default null)
returns table(
  note_id      uuid,
  note_date    date,
  period       text,
  school_name  text,
  teacher_name text,
  student_name text,
  is_private   boolean,
  content      text,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_districts uuid[];
begin
  if coalesce(length(trim(p_reason)), 0) < 10 then
    raise exception 'A specific reason (at least 10 characters) is required to open the notes archive';
  end if;

  if public.has_role('founder') then
    if p_district_id is not null then
      v_districts := array[p_district_id];
    else
      select array_agg(id) into v_districts from public.districts;
    end if;
  else
    select array_agg(distinct district_id) into v_districts
    from public.role_assignments
    where user_id = auth.uid() and role = 'district_admin' and district_id is not null;

    if v_districts is null then
      raise exception 'not authorized: district_admin role required'
        using errcode = 'insufficient_privilege';
    end if;

    if p_district_id is not null then
      if p_district_id = any(v_districts) then
        v_districts := array[p_district_id];
      else
        raise exception 'not authorized for this district'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;

  -- The audit row is the point: record access is itself part of the record.
  insert into public.audit_log (actor_user_id, action, target_table, reason, after)
  values (
    auth.uid(), 'notes.archive_access', 'notes', trim(p_reason),
    jsonb_build_object('district_ids', to_jsonb(v_districts))
  );

  return query
    select n.id,
           n.note_date,
           n.period,
           sc.name,
           t.full_name,
           coalesce(nullif(trim(s.first_name || ' ' || s.last_name), ''), s.first_name),
           n.is_private,
           n.content,
           n.created_at
    from public.notes n
    join public.students s on s.id = n.student_id
    join public.schools sc on sc.id = s.school_id
    join public.teachers t on t.id = n.teacher_id
    where sc.district_id = any(v_districts)
    order by n.note_date desc, n.created_at desc;
end;
$function$;

grant execute on function public.district_notes_archive(text, uuid) to authenticated;

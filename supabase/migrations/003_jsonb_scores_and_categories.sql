-- Migration: Switch to JSONB scores and add teacher categories configuration.
-- This enables fully dynamic/customizable behavior categories per teacher.

-- 1. Add categories JSON column to teachers (stores category definitions)
alter table teachers
  add column categories jsonb not null default '[
    {"id": "arrival", "name": "Arrival", "type": "arrival", "options": ["On Time", "L", "L/E"], "maxPoints": 3},
    {"id": "compliance", "name": "Compliance", "type": "scale", "options": ["0","1","2","3"], "maxPoints": 3},
    {"id": "social", "name": "Social", "type": "scale", "options": ["0","1","2","3"], "maxPoints": 3},
    {"id": "onTask", "name": "On-Task", "type": "scale", "options": ["0","1","2","3"], "maxPoints": 3},
    {"id": "phoneAway", "name": "Phone Away", "type": "toggle", "options": ["Yes", "No"], "maxPoints": 3}
  ]'::jsonb;

-- 2. Add JSONB scores column to behavior_scores
--    Format: {"arrival": 2, "compliance": 3, "social": 1, "onTask": 2, "phoneAway": 1}
alter table behavior_scores
  add column scores jsonb;

-- 3. Backfill scores JSONB from existing typed columns
update behavior_scores set scores = jsonb_build_object(
  'arrival', arrival,
  'compliance', compliance,
  'social', social,
  'onTask', on_task,
  'phoneAway', case when phone_away then 1 else 0 end
)
where scores is null;

-- 4. Update ensure_teacher_exists to return categories
create or replace function ensure_teacher_exists(
  p_auth_id uuid,
  p_email text,
  p_full_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher record;
  v_school_id uuid;
begin
  select t.*, s.name as school_name
  into v_teacher
  from teachers t
  join schools s on s.id = t.school_id
  where t.auth_id = p_auth_id;

  if found then
    return json_build_object(
      'teacher_id', v_teacher.id,
      'school_id', v_teacher.school_id,
      'school_name', v_teacher.school_name,
      'full_name', v_teacher.full_name,
      'email', v_teacher.email,
      'categories', v_teacher.categories
    );
  end if;

  insert into schools (name, district)
  values ('My School', 'EGUSD')
  returning id into v_school_id;

  insert into teachers (auth_id, school_id, full_name, email)
  values (p_auth_id, v_school_id, p_full_name, p_email);

  select t.*, s.name as school_name
  into v_teacher
  from teachers t
  join schools s on s.id = t.school_id
  where t.auth_id = p_auth_id;

  return json_build_object(
    'teacher_id', v_teacher.id,
    'school_id', v_teacher.school_id,
    'school_name', v_teacher.school_name,
    'full_name', v_teacher.full_name,
    'email', v_teacher.email,
    'categories', v_teacher.categories
  );
end;
$$;

-- 5. Allow teachers to update their own profile (for saving categories)
create policy "Teachers can update own profile"
  on teachers for update using (auth_id = auth.uid());

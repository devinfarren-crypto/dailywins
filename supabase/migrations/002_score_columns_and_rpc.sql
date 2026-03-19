-- Migration: Update behavior_scores columns from boolean to smallint,
-- add RPC for teacher auto-creation, and add missing RLS policies.

-- 1. Change score columns to smallint (0-3 scale) and make nullable for "unscored"
--    arrival: 3=On Time, 1=Late Excused, 0=Late, null=unscored
--    compliance/social/on_task: 0-3 scale, null=unscored
alter table behavior_scores
  alter column arrival type smallint using (case when arrival then 3 else 0 end),
  alter column arrival drop not null,
  alter column arrival drop default,
  alter column compliance type smallint using (case when compliance then 2 else 0 end),
  alter column compliance drop not null,
  alter column compliance drop default,
  alter column social type smallint using (case when social then 2 else 0 end),
  alter column social drop not null,
  alter column social drop default,
  alter column on_task type smallint using (case when on_task then 2 else 0 end),
  alter column on_task drop not null,
  alter column on_task drop default;

-- phone_away stays boolean but make nullable
alter table behavior_scores
  alter column phone_away drop not null,
  alter column phone_away drop default;

-- Add check constraints for score ranges
alter table behavior_scores
  add constraint arrival_range check (arrival is null or arrival between 0 and 3),
  add constraint compliance_range check (compliance is null or compliance between 0 and 3),
  add constraint social_range check (social is null or social between 0 and 3),
  add constraint on_task_range check (on_task is null or on_task between 0 and 3);

-- 2. Add display_name to students for flexibility (teachers enter initials or names)
alter table students
  add column display_name text;

-- Backfill display_name from first_name + last_name
update students set display_name = trim(first_name || ' ' || last_name);

-- Make first_name/last_name optional (display_name is primary)
alter table students
  alter column first_name drop not null,
  alter column last_name drop not null;

-- 3. RPC: ensure_teacher_exists
-- Called on login. Creates school + teacher record if missing.
-- Runs as security definer to bypass RLS for first-time setup.
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
  -- Check if teacher already exists
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
      'email', v_teacher.email
    );
  end if;

  -- Create a default school for the teacher
  insert into schools (name, district)
  values ('My School', 'EGUSD')
  returning id into v_school_id;

  -- Create the teacher record
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
    'email', v_teacher.email
  );
end;
$$;

-- 4. Missing RLS policies

-- Teachers can insert students at their school
create policy "Teachers can insert students at their school"
  on students for insert with check (
    school_id in (select school_id from teachers where auth_id = auth.uid())
  );

-- Teachers can delete students at their school
create policy "Teachers can delete students at their school"
  on students for delete using (
    school_id in (select school_id from teachers where auth_id = auth.uid())
  );

-- Teachers can delete their own scores (for clearing)
create policy "Teachers can delete own scores"
  on behavior_scores for delete using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

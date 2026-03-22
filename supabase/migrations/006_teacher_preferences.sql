-- Teacher dashboard preferences (theme, font, icon, etc.)
alter table teachers
  add column preferences jsonb not null default '{}'::jsonb;

-- Update RPC to return preferences
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
      'categories', v_teacher.categories,
      'preferences', v_teacher.preferences
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
    'categories', v_teacher.categories,
    'preferences', v_teacher.preferences
  );
end;
$$;

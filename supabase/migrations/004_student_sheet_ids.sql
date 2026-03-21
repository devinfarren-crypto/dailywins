-- Store Google Sheet IDs per student-teacher pair for auto-sync
create table student_sheets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  sheet_id text not null,
  folder_id text,
  created_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

create index idx_student_sheets_teacher on student_sheets(teacher_id);

alter table student_sheets enable row level security;

create policy "Teachers can view own sheets"
  on student_sheets for select using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can insert own sheets"
  on student_sheets for insert with check (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can update own sheets"
  on student_sheets for update using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

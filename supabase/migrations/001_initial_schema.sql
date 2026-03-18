-- DailyWins initial schema

-- Schools
create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text not null,
  created_at timestamptz not null default now()
);

-- Teachers (linked to Supabase Auth via auth.users)
create table teachers (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Students
create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  grade_level smallint,
  created_at timestamptz not null default now()
);

-- Behavior scores (one row per student per teacher per period per day)
create table behavior_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  score_date date not null default current_date,
  period smallint not null check (period between 1 and 8),
  arrival boolean not null default false,
  compliance boolean not null default false,
  social boolean not null default false,
  on_task boolean not null default false,
  phone_away boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, teacher_id, score_date, period)
);

-- Notes
create table notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  note_date date not null default current_date,
  content text not null,
  is_private boolean not null default true,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_behavior_scores_student_date on behavior_scores(student_id, score_date);
create index idx_behavior_scores_teacher_date on behavior_scores(teacher_id, score_date);
create index idx_notes_student_date on notes(student_id, note_date);
create index idx_students_school on students(school_id);
create index idx_teachers_school on teachers(school_id);

-- Updated_at trigger for behavior_scores
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger behavior_scores_updated_at
  before update on behavior_scores
  for each row execute function update_updated_at();

-- Row Level Security
alter table schools enable row level security;
alter table teachers enable row level security;
alter table students enable row level security;
alter table behavior_scores enable row level security;
alter table notes enable row level security;

-- Teachers can read their own school
create policy "Teachers can view their school"
  on schools for select using (
    id in (select school_id from teachers where auth_id = auth.uid())
  );

-- Teachers can read/update their own record
create policy "Teachers can view own profile"
  on teachers for select using (auth_id = auth.uid());

-- Teachers can view students at their school
create policy "Teachers can view students at their school"
  on students for select using (
    school_id in (select school_id from teachers where auth_id = auth.uid())
  );

-- Teachers can manage their own behavior scores
create policy "Teachers can view own scores"
  on behavior_scores for select using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can insert own scores"
  on behavior_scores for insert with check (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can update own scores"
  on behavior_scores for update using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

-- Teachers can manage their own notes; see shared notes from others at their school
create policy "Teachers can view own and shared notes"
  on notes for select using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
    or (
      is_private = false
      and student_id in (
        select s.id from students s
        join teachers t on t.school_id = s.school_id
        where t.auth_id = auth.uid()
      )
    )
  );

create policy "Teachers can insert own notes"
  on notes for insert with check (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can update own notes"
  on notes for update using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

create policy "Teachers can delete own notes"
  on notes for delete using (
    teacher_id in (select id from teachers where auth_id = auth.uid())
  );

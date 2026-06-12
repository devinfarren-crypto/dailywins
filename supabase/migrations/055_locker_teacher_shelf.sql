-- 055: The teacher shelf (docs/locker/teacher-shelf.md).
-- Teachers place real-world rewards (homework passes, snack coupons,
-- shoutouts) on a student's locker shelf as GRANTS — points_ledger is never
-- touched. State machine:
--   granted -> pending_redemption (student taps "Use this")
--           -> redeemed (teacher confirms; auto-archives after 5 days)
--   teacher may also return pending -> granted, or revoke outright.

create table public.shelf_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  granted_by uuid not null references public.teachers(id),
  template_id text not null check (template_id in
    ('hw-pass','late-pass','snack-coupon','front-of-line','shoutout','custom')),
  custom_label text check (char_length(custom_label) <= 40),
  note text check (char_length(note) <= 280),
  status text not null default 'granted'
    check (status in ('granted','pending_redemption','redeemed','revoked','archived')),
  granted_at timestamptz not null default now(),
  requested_at timestamptz,
  redeemed_at timestamptz,
  seen_at timestamptz
);

create index shelf_items_student_idx on public.shelf_items (student_id) where status in ('granted','pending_redemption','redeemed');
create index shelf_items_teacher_idx on public.shelf_items (granted_by) where status = 'pending_redemption';

-- Same posture as every locker table: RLS on, ZERO policies. All access goes
-- through server routes (locker cookie for students, session for teachers).
alter table public.shelf_items enable row level security;

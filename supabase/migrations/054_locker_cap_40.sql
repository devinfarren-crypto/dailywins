-- Migration 054: locker layout cap 30 → 40 (Prompt 2 density decision).
-- A great locker is layered and a little chaotic; 40 opaque absolutely
-- positioned images is within Chromebook budget on paper — Devin eyeballs
-- drag feel on real hardware and we drop back if it stutters.
-- Rollback: recreate the check at 30.
alter table public.locker_layouts
  drop constraint if exists locker_layouts_layout_check;
alter table public.locker_layouts
  add constraint locker_layouts_layout_check
  check (jsonb_array_length(layout->'items') <= 40);

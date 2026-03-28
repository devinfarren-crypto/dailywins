-- Add period column to notes table for per-period note tracking
-- Nullable for backward compatibility with existing flat notes (they'll show as "General" period)
alter table notes add column period text;

-- Update index to include period for efficient lookups
create index idx_notes_student_date_period on notes(student_id, note_date, period);

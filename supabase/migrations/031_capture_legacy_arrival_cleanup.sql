-- 031_capture_legacy_arrival_cleanup.sql
-- Capture the legacy arrival re-encoding cleanup as a tracked migration, and
-- finish the rows the original live-only fix missed.
--
-- BACKGROUND: Commit adaeb5f (5/27) switched the `arrival` category from storing
-- point-VALUES to storing option-INDICES. The arrival category is defined in
-- app/dashboard/DashboardClient.tsx as:
--     options:      ["On Time", "L", "L/E"]
--     pointValues:  [3,          0,    3   ]
-- so the only valid stored values are option indices 0, 1, 2. A stored `3` is a
-- leftover point-value from the old encoding, NOT a valid index — the dashboard
-- renders it blank because options[3] is undefined.
--
-- The 5/27 cleanup was run as ad-hoc SQL directly against prod and never landed
-- in git. It also did not fully finish: as of this migration, prod still holds
-- 6 rows with scores->>'arrival' = '3' (5 dated 2026-05-14, 1 dated 2026-05-27).
-- This file both (a) captures the intent of that cleanup so a fresh rebuild /
-- staging reaches the same state, and (b) cleans the 6 stragglers still in prod.
--
-- THE AMBIGUITY (and the decision): under the old encoding a stored `3` mapped to
-- a 3-point arrival, which is ambiguously "On Time" (index 0) OR "L/E" (index 2) —
-- both worth 3 points — so the value alone cannot tell us which the teacher meant.
-- Decision (Devin, 6/01): map every out-of-range `3` to index 0 ("On Time").
-- Rationale: On Time is ~91% of all non-null arrivals (1486 of ~1631), and the
-- app's own pointValues.indexOf(3) already resolves a stray 3 to index 0, so this
-- matches how the UI would interpret it. A small number may truly have been "L/E";
-- that distinction is unrecoverable from the data and is accepted as lossy.
--
-- This migration does NOT touch the unrecoverable collision case (an unconverted
-- old point-value `0` = "L"/index 1 now reads as index 0 = "On Time"); those rows
-- are indistinguishable from legitimately-converted On Time rows and have no
-- detectable victims. Only the out-of-range `3` rows are addressable.
--
-- IDEMPOTENT: the WHERE clause only matches numeric arrival values > 2, so after
-- this runs there are no matching rows and a re-run is a no-op. Safe on staging
-- (where the live-only cleanup may already have completed — 0 rows match).

UPDATE public.behavior_scores
SET scores = jsonb_set(scores, '{arrival}', '0'::jsonb)
WHERE jsonb_typeof(scores->'arrival') = 'number'
  AND (scores->>'arrival')::int > 2;

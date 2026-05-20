-- Migration 012: loosen is_valid_schedules() to accept extended schedule fields
--
-- BACKGROUND
-- The AI bell-schedule uploader (app/api/schedule/parse + save) and the Zod
-- schema (src/lib/schedules-schema.ts) both work with an EXTENDED schedule
-- shape that includes optional fields beyond the original core set:
--
--   Per period:  type, parent, day_notes      (in addition to label/start/end)
--   Per variant: days, specific_dates, notes   (in addition to periods)
--
-- These fields are load-bearing for the uploader:
--   - type = 'non_student' excludes blocks like PSAT/Grad from scoring
--   - days / specific_dates distinguish recurring vs one-off schedules
--   - parent relates split periods
--
-- The migration 010 version of is_valid_schedules() was written to REQUIRE the
-- core keys. (A stricter draft that also REJECTED unknown keys was discussed;
-- the version actually living in prod as of 2026-05-20 does NOT reject unknown
-- keys.) This migration formalizes the intended contract: REQUIRE the core keys,
-- ALLOW the known extended keys, and otherwise stay permissive. It is the single
-- source of truth going forward and supersedes whatever shape 010 left on disk.
--
-- Apply against the P1.5 STAGING branch FIRST, verify an AI-uploaded schedule
-- with extended fields saves cleanly, THEN promote to prod. Never fat-finger prod.
--
-- This replaces the function in place; the existing CHECK constraint
-- (check (is_valid_schedules(schedules))) continues to call it, so no constraint
-- changes are needed.

create or replace function public.is_valid_schedules(s jsonb)
  returns boolean
  language plpgsql
  immutable
as $function$
DECLARE
  variant_value jsonb;
  period_value  jsonb;
  k             text;
BEGIN
  -- NULL schedules are allowed (a school may have no schedule yet).
  IF s IS NULL THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(s) != 'object' THEN
    RETURN false;
  END IF;

  FOR variant_value IN SELECT value FROM jsonb_each(s)
  LOOP
    IF jsonb_typeof(variant_value) != 'object' THEN
      RETURN false;
    END IF;

    -- Every variant must contain a periods array.
    IF NOT (variant_value ? 'periods') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(variant_value->'periods') != 'array' THEN
      RETURN false;
    END IF;

    -- Variant may only contain the known key set.
    FOR k IN SELECT jsonb_object_keys(variant_value)
    LOOP
      IF k NOT IN ('periods', 'days', 'specific_dates', 'notes', 'type') THEN
        RETURN false;
      END IF;
    END LOOP;

    FOR period_value IN SELECT * FROM jsonb_array_elements(variant_value->'periods')
    LOOP
      IF jsonb_typeof(period_value) != 'object' THEN
        RETURN false;
      END IF;

      -- Every period must have non-empty string label/start/end.
      IF NOT (period_value ? 'label')
        OR NOT (period_value ? 'start')
        OR NOT (period_value ? 'end') THEN
        RETURN false;
      END IF;
      IF jsonb_typeof(period_value->'label') != 'string'
        OR jsonb_typeof(period_value->'start') != 'string'
        OR jsonb_typeof(period_value->'end') != 'string' THEN
        RETURN false;
      END IF;
      IF length(period_value->>'label') = 0
        OR length(period_value->>'start') = 0
        OR length(period_value->>'end') = 0 THEN
        RETURN false;
      END IF;

      -- Period may only contain the known key set.
      FOR k IN SELECT jsonb_object_keys(period_value)
      LOOP
        IF k NOT IN ('label', 'start', 'end', 'type', 'parent', 'day_notes') THEN
          RETURN false;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN true;
END;
$function$;

-- Migration 012: loosen is_valid_schedules() to accept extended schedule fields
--
-- The AI uploader and Zod schema use an extended schedule shape with optional
-- fields beyond label/start/end (period: type, parent, day_notes; variant:
-- days, specific_dates, notes). The migration 010 function rejected unknown
-- keys, so those fields fail the CHECK. This replaces the function to ALLOW the
-- known extended set while still REQUIRING core keys and REJECTING genuinely
-- unknown keys (catches uploader typos).
--
-- Cannot use CREATE OR REPLACE: the param is renamed (p_schedules -> s) and the
-- schools_schedules_valid CHECK depends on the function. Must drop the
-- constraint, drop the function, create fresh, then re-add the constraint.
-- Proven on staging 2026-05-20. Apply to staging first, then prod.

alter table public.schools drop constraint if exists schools_schedules_valid;
drop function if exists public.is_valid_schedules(jsonb);

create function public.is_valid_schedules(s jsonb)
  returns boolean
  language plpgsql
  immutable
as $function$
DECLARE
  variant_value jsonb;
  period_value  jsonb;
  k             text;
BEGIN
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
    IF NOT (variant_value ? 'periods') THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(variant_value->'periods') != 'array' THEN
      RETURN false;
    END IF;
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

alter table public.schools
  add constraint schools_schedules_valid
  check (is_valid_schedules(schedules));

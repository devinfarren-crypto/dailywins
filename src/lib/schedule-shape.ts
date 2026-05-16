/**
 * Translates the AI parse route's output (`ExtractedSchedule`, with a variants
 * array) into the DB JSONB shape (`Schedules`, an object keyed by variant name).
 *
 * Used by the save endpoint to convert what the uploader sends into what the
 * database expects, and to merge new variants into an existing schedule.
 */

import type { Schedules, Variant, Period } from "./schedules-schema";

// --- Mirror the types from app/api/schedule/parse/route.ts. ---
// We don't import from the route because importing route files into other
// route files / lib files is a Next.js anti-pattern.

export type ScheduleType = "class" | "break" | "non_student";

export interface ExtractedPeriod {
  name: string;
  start: string;
  end: string;
  type: ScheduleType;
  parent: string | null;
  day_notes: string | null;
}

export interface ExtractedVariant {
  name: string;
  days: string[] | null;
  specific_dates: string[] | null;
  notes: string | null;
  periods: ExtractedPeriod[];
}

export interface ExtractedSchedule {
  school_name: string | null;
  school_year: string | null;
  variants: ExtractedVariant[];
  uncertainties: string[];
}

/**
 * Normalize a time string to HH:MM (24-hour, zero-padded).
 *
 * The DB currently has inconsistent times like "8:30" and "08:30". The AI
 * uploader emits zero-padded times per its system prompt, but we normalize
 * everything here so saved data is uniform regardless of source.
 *
 * Accepts: "8:30", "08:30", "8:30 AM", "08:30 PM", "14:30"
 * Returns: "08:30", "14:30"
 *
 * If the input is unparseable, returns it unchanged — the schema will fail
 * the save and the user gets a clear error rather than silent corruption.
 */
export function normalizeTime(time: string): string {
  const trimmed = time.trim();

  // Try 12-hour with AM/PM first
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2];
    const isPM = ampmMatch[3].toUpperCase() === "PM";
    if (hour === 12) hour = isPM ? 12 : 0;
    else if (isPM) hour += 12;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  // 24-hour, possibly missing leading zero on hour
  const hmMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) {
    const hour = parseInt(hmMatch[1], 10);
    const minute = hmMatch[2];
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:${minute}`;
    }
  }

  // Unparseable — return as-is and let schema validation fail.
  return trimmed;
}

/**
 * Translate one ExtractedPeriod into the DB Period shape.
 *
 * Note the field rename: `name` -> `label`. This is the historical DB shape.
 * Renaming it everywhere is a bigger commit; for now, we translate at the
 * write boundary.
 */
function translatePeriod(p: ExtractedPeriod): Period {
  return {
    label: p.name,
    start: normalizeTime(p.start),
    end: normalizeTime(p.end),
    type: p.type,
    parent: p.parent,
    day_notes: p.day_notes,
  };
}

/**
 * Translate one ExtractedVariant into the DB Variant shape.
 */
function translateVariant(v: ExtractedVariant): Variant {
  return {
    periods: v.periods.map(translatePeriod),
    days: v.days,
    specific_dates: v.specific_dates,
    notes: v.notes,
  };
}

/**
 * Translate the full ExtractedSchedule into a DB-shape Schedules object.
 *
 * Variants are keyed by name. If the source has two variants with the same
 * name (shouldn't happen — the AI route deduplicates), the second wins. Any
 * downstream caller wanting to detect that should compare lengths.
 */
export function translateToDbShape(extracted: ExtractedSchedule): NonNullable<Schedules> {
  const result: Record<string, Variant> = {};
  for (const variant of extracted.variants) {
    result[variant.name] = translateVariant(variant);
  }
  return result;
}

/**
 * Merge a new schedule into an existing one.
 *
 * Strategy: union by variant name. New variants are added, existing variants
 * with the same name are replaced. Old variants that don't appear in the new
 * upload are preserved.
 *
 * Example:
 *   existing = { Regular: {...}, Finals: {...old finals data...} }
 *   incoming = { Finals: {...new finals data...}, Rally: {...} }
 *   merged   = { Regular: {...}, Finals: {...new finals data...}, Rally: {...} }
 *
 * Rationale: teachers may have hand-edited an existing variant after a prior
 * upload. Replacing only the variants present in the new upload preserves
 * those edits for any untouched variants.
 */
export function mergeSchedules(
  existing: NonNullable<Schedules> | null,
  incoming: NonNullable<Schedules>,
): NonNullable<Schedules> {
  if (!existing) return incoming;
  return { ...existing, ...incoming };
}

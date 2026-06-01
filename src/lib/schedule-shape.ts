/**
 * Translates the AI parse route's output (`ExtractedSchedule`, with a variants
 * array) into the DB JSONB shape (`Schedules`, an object keyed by variant name).
 *
 * Used by the save endpoint to convert what the uploader sends into what the
 * database expects, and to merge new variants into an existing schedule.
 *
 * v2 changes vs v1:
 *  - normalizeTime returns null on invalid input (was: returned trimmed string)
 *  - translator now throws TranslationError on bad data, caught by the route
 *  - explicit per-period and per-variant validation, since the Zod schema
 *    only checks "non-empty string" and would accept e.g. "8:99" as a time
 */

import type { Schedules, Variant, Period } from "./schedules-schema";

// --- Mirror the types from app/api/schedule/parse/route.ts. ---

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
 * Thrown by translateToDbShape when input data is malformed in a way the Zod
 * schema cannot catch (e.g., unparseable time strings, hours out of range,
 * empty period lists). The save route catches this and returns 400.
 */
export class TranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslationError";
  }
}

/**
 * Normalize a time string to HH:MM (24-hour, zero-padded).
 *
 * Returns null if the input is invalid (out-of-range hour, out-of-range
 * minute, or unparseable format). Callers must handle null.
 *
 * Accepts: "8:30", "08:30", "8:30 AM", "08:30 PM", "14:30"
 * Returns: "08:30", "14:30" — or null.
 */
export function normalizeTime(time: string): string | null {
  const trimmed = time.trim();

  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = parseInt(ampmMatch[2], 10);
    const isPM = ampmMatch[3].toUpperCase() === "PM";
    if (hour < 1 || hour > 12) return null;
    if (minute < 0 || minute > 59) return null;
    if (hour === 12) hour = isPM ? 12 : 0;
    else if (isPM) hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  const hmMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (hmMatch) {
    const hour = parseInt(hmMatch[1], 10);
    const minute = parseInt(hmMatch[2], 10);
    if (hour < 0 || hour > 23) return null;
    if (minute < 0 || minute > 59) return null;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  return null;
}

function translatePeriod(p: ExtractedPeriod, context: string): Period {
  if (typeof p.name !== "string" || p.name.length === 0) {
    throw new TranslationError(`${context}: period missing name`);
  }
  if (!["class", "break", "non_student"].includes(p.type)) {
    throw new TranslationError(
      `${context}: period "${p.name}" has invalid type "${p.type}"`,
    );
  }
  const start = normalizeTime(p.start);
  if (start === null) {
    throw new TranslationError(
      `${context}: period "${p.name}" has invalid start time "${p.start}"`,
    );
  }
  const end = normalizeTime(p.end);
  if (end === null) {
    throw new TranslationError(
      `${context}: period "${p.name}" has invalid end time "${p.end}"`,
    );
  }
  return {
    label: p.name,
    start,
    end,
    type: p.type,
    parent: p.parent,
    day_notes: p.day_notes,
  };
}

function translateVariant(v: ExtractedVariant): Variant {
  if (typeof v.name !== "string" || v.name.length === 0) {
    throw new TranslationError("variant missing name");
  }
  if (!Array.isArray(v.periods) || v.periods.length === 0) {
    throw new TranslationError(`variant "${v.name}" has no periods`);
  }
  return {
    periods: v.periods.map((p) => translatePeriod(p, `variant "${v.name}"`)),
    days: v.days,
    specific_dates: v.specific_dates,
    notes: v.notes,
  };
}

/**
 * Translate the full ExtractedSchedule into a DB-shape Schedules object.
 * Throws TranslationError on malformed input.
 */
export function translateToDbShape(
  extracted: ExtractedSchedule,
): NonNullable<Schedules> {
  if (!extracted || typeof extracted !== "object") {
    throw new TranslationError("schedule must be an object");
  }
  if (!Array.isArray(extracted.variants) || extracted.variants.length === 0) {
    throw new TranslationError("schedule has no variants");
  }
  const result: Record<string, Variant> = {};
  for (const variant of extracted.variants) {
    // The DB shape is keyed by variant name, so duplicates would silently
    // clobber each other. Reject them — the editor can have two unnamed "New
    // schedule" rows, and losing one to a silent overwrite would be worse than
    // a clear error telling the admin to rename.
    if (Object.prototype.hasOwnProperty.call(result, variant.name)) {
      throw new TranslationError(
        `two variants are both named "${variant.name}" — rename one so they don't overwrite each other`,
      );
    }
    result[variant.name] = translateVariant(variant);
  }
  return result;
}

/**
 * Merge a new schedule into an existing one.
 *
 * Strategy: union by variant name. New variants are added, existing variants
 * with the same name are replaced. Variants not in the new upload are preserved.
 *
 * NOTE: This is union-only — it cannot DELETE a variant. The PDF-upload flow
 * wants that (a partial upload must not clobber other variants). The full-edit
 * flow needs deletes to persist, so the save route writes the edited set
 * directly in "replace" mode instead of calling this. See app/api/schedule/save.
 */
export function mergeSchedules(
  existing: NonNullable<Schedules> | null,
  incoming: NonNullable<Schedules>,
): NonNullable<Schedules> {
  if (!existing) return incoming;
  return { ...existing, ...incoming };
}

/**
 * Reverse of translateToDbShape: turn the stored DB JSONB (`Schedules`, keyed
 * by variant name, periods using `label`) back into the editor's
 * `ExtractedSchedule` (variants array, periods using `name`).
 *
 * Used by the edit-existing flow so a Site Admin can load their current
 * schedule into the same review/edit UI the PDF uploader uses.
 *
 * Defaults fill the gaps where the DB shape is looser than the editor shape:
 *  - period.type defaults to "class" (matches getPeriodType + how the app
 *    already treats type-less legacy periods)
 *  - parent/day_notes/days/specific_dates/notes default to null
 *  - uncertainties is [] (nothing was AI-inferred — the human is the source)
 *
 * Round-trips with translateToDbShape modulo those defaults.
 */
export function dbShapeToExtracted(
  schedules: NonNullable<Schedules>,
  schoolName?: string | null,
): ExtractedSchedule {
  const variants: ExtractedVariant[] = Object.entries(schedules).map(
    ([name, variant]) => ({
      name,
      days: variant.days ?? null,
      specific_dates: variant.specific_dates ?? null,
      notes: variant.notes ?? null,
      periods: variant.periods.map((p) => ({
        name: p.label,
        start: p.start,
        end: p.end,
        type: (p.type ?? "class") as ScheduleType,
        parent: p.parent ?? null,
        day_notes: p.day_notes ?? null,
      })),
    }),
  );
  return {
    school_name: schoolName ?? null,
    school_year: null,
    variants,
    uncertainties: [],
  };
}

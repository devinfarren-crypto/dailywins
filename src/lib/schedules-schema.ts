import { z } from "zod";

/**
 * Period schema.
 *
 * Backward compat: existing data in production has only { label, start, end }.
 * The new fields (type, parent, day_notes) are optional and default to safe
 * values when absent, so old rows continue to validate.
 *
 * NOTE: .strict() removed from v1. The DB JSONB may contain old-shape rows
 * with no extra fields, but new rows from the AI uploader will include the
 * extended fields. Allowing passthrough lets both coexist during migration.
 */
export const PeriodSchema = z.object({
  label: z
    .string({
      required_error: "Period needs a label",
      invalid_type_error: "Period label must be text",
    })
    .min(1, "Period label can't be empty"),
  start: z
    .string({
      required_error: "Period needs a start time",
      invalid_type_error: "Period start time must be text",
    })
    .min(1, "Period start time can't be empty"),
  end: z
    .string({
      required_error: "Period needs an end time",
      invalid_type_error: "Period end time must be text",
    })
    .min(1, "Period end time can't be empty"),
  // --- Extended fields (optional, added by AI uploader). ---
  // "class" = scoring period the teacher tracks behavior for.
  // "break" = lunch/passing/nutrition (visible but not scored).
  // "non_student" = staff-only or senior-only blocks (skipped entirely).
  // When missing on existing data, the reader defaults to "class" — preserves
  // existing behavior since the app today treats every period as scoreable.
  type: z.enum(["class", "break", "non_student"]).optional(),
  // Parent period name if this row is a sub-block (e.g., "Assembly A" inside "Period 1").
  parent: z.string().nullable().optional(),
  // Literal day-mapping text from the PDF (e.g., "Mon – Per. 1 / Tues – Per. 2").
  day_notes: z.string().nullable().optional(),
});

export const VariantSchema = z.object({
  periods: z.array(PeriodSchema, {
    required_error: "Schedule variant needs a periods list",
    invalid_type_error: "Periods must be a list",
  }),
  // --- Extended fields (optional). ---
  // Days of the week this variant recurs on, e.g. ["MON","TUE","WED","THU","FRI"].
  // null/undefined means "no day constraint" (legacy data, or one-off variants).
  days: z.array(z.string()).nullable().optional(),
  // Specific ISO dates this variant applies to (e.g. finals on May 28/29).
  specific_dates: z.array(z.string()).nullable().optional(),
  // Free-text footnote from the source PDF.
  notes: z.string().nullable().optional(),
});

export const SchedulesSchema = z
  .record(
    z.string({
      required_error: "Schedule must have a name",
      invalid_type_error: "Schedule name must be text",
    }),
    VariantSchema,
  )
  .refine((val) => Object.keys(val).length > 0, {
    message: "Add at least one schedule variant",
  })
  .nullable();

export type Period = z.infer<typeof PeriodSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Schedules = z.infer<typeof SchedulesSchema>;

export function parseSchedules(input: unknown): Schedules {
  return SchedulesSchema.parse(input);
}

export function safeParseSchedules(input: unknown) {
  return SchedulesSchema.safeParse(input);
}

/**
 * Period type for downstream consumers. When a period is missing the `type`
 * field (legacy data), it defaults to "class" — meaning the existing app
 * behavior (every period is scoreable) is preserved.
 */
export function getPeriodType(period: Period): "class" | "break" | "non_student" {
  return period.type ?? "class";
}

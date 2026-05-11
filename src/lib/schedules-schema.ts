import { z } from "zod";

export const PeriodSchema = z
  .object({
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
  })
  .strict();

export const VariantSchema = z
  .object({
    periods: z.array(PeriodSchema, {
      required_error: "Schedule variant needs a periods list",
      invalid_type_error: "Periods must be a list",
    }),
  })
  .strict();

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

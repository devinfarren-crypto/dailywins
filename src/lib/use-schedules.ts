"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SchedulesSchema, type Schedules } from "./schedules-schema";

/**
 * Returns the bell schedules for a given school.
 *
 * Strategy: starts with the provided `fallback` (the hardcoded TS schedules)
 * for immediate, synchronous render. Then asynchronously queries the database
 * for `schools.schedules` and, if it returns valid data, swaps to that.
 *
 * If the DB returns NULL, errors, or fails Zod validation, the hook stays on
 * the fallback indefinitely. The user never sees an error or a loading state.
 *
 * @param supabase - The Supabase client (already instantiated by the caller)
 * @param schoolName - The current school name, or null/empty before load
 * @param fallback - The hardcoded TS schedules for this school (always-available data)
 */
export function useSchedules(
  supabase: SupabaseClient,
  schoolName: string | null | undefined,
  fallback: NonNullable<Schedules>
): NonNullable<Schedules> {
  const [schedules, setSchedules] = useState<NonNullable<Schedules>>(fallback);

  useEffect(() => {
    if (!schoolName) {
      setSchedules(fallback);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("schedules")
        .eq("name", schoolName)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setSchedules(fallback);
        return;
      }

      if (data.schedules === null || data.schedules === undefined) {
        setSchedules(fallback);
        return;
      }

      const parsed = SchedulesSchema.safeParse(data.schedules);
      if (!parsed.success || parsed.data === null) {
        setSchedules(fallback);
        return;
      }

      setSchedules(parsed.data);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, schoolName, fallback]);

  return schedules;
}

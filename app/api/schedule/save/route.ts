import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import {
  translateToDbShape,
  mergeSchedules,
  type ExtractedSchedule,
} from "@/src/lib/schedule-shape";
import { SchedulesSchema, type Schedules } from "@/src/lib/schedules-schema";

interface SaveRequestBody {
  school_id: string;
  schedule: ExtractedSchedule;
}

interface SaveErrorResponse {
  error: string;
  detail?: string;
}

interface SaveSuccessResponse {
  ok: true;
  school_id: string;
  variants_saved: number;
  variants_total: number;
}

/**
 * Lightweight shape check for the request body. We could pull in Zod for this
 * but the parse route already validates the schedule shape downstream — here
 * we just confirm the request envelope.
 */
function isValidSaveRequest(body: unknown): body is SaveRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.school_id !== "string" || b.school_id.length === 0) return false;
  if (!b.schedule || typeof b.schedule !== "object") return false;
  const s = b.schedule as Record<string, unknown>;
  if (!Array.isArray(s.variants)) return false;
  if (!Array.isArray(s.uncertainties)) return false;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<SaveErrorResponse>(
        { error: "not_authenticated", detail: "You must be signed in." },
        { status: 401 },
      );
    }

    // --- Parse and validate the request body. ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<SaveErrorResponse>(
        { error: "invalid_json", detail: "Request body was not valid JSON." },
        { status: 400 },
      );
    }

    if (!isValidSaveRequest(body)) {
      return NextResponse.json<SaveErrorResponse>(
        {
          error: "invalid_request",
          detail: "Request must have school_id and schedule.variants.",
        },
        { status: 400 },
      );
    }

    const { school_id, schedule } = body;

    // --- Authorization: must be admin of this school. ---
    // RLS on schools.UPDATE also enforces this, but we check explicitly so we
    // can return a clear 403 instead of a confusing "no rows updated" silent fail.
    const { data: adminCheck, error: adminError } = await supabase.rpc(
      "is_school_admin",
      { target_school_id: school_id },
    );

    if (adminError) {
      console.error("[schedule/save] is_school_admin RPC failed:", adminError);
      return NextResponse.json<SaveErrorResponse>(
        { error: "auth_check_failed", detail: adminError.message },
        { status: 500 },
      );
    }

    if (!adminCheck) {
      return NextResponse.json<SaveErrorResponse>(
        {
          error: "forbidden",
          detail: "You are not an admin of this school.",
        },
        { status: 403 },
      );
    }

    // --- Fetch existing schedule for merge. ---
    const { data: existingRow, error: fetchError } = await supabase
      .from("schools")
      .select("schedules")
      .eq("id", school_id)
      .maybeSingle();

    if (fetchError) {
      console.error("[schedule/save] fetch existing failed:", fetchError);
      return NextResponse.json<SaveErrorResponse>(
        { error: "fetch_failed", detail: fetchError.message },
        { status: 500 },
      );
    }

    if (!existingRow) {
      return NextResponse.json<SaveErrorResponse>(
        { error: "school_not_found", detail: `No school with id ${school_id}` },
        { status: 404 },
      );
    }

    // --- Translate + merge. ---
    const incomingDbShape = translateToDbShape(schedule);
    const existingSchedules = (existingRow.schedules as Schedules) ?? null;
    const merged = mergeSchedules(existingSchedules, incomingDbShape);

    // --- Validate the merged result against the schema before writing. ---
    // This is the last line of defense: if the merged shape doesn't match our
    // Zod schema, the hook would silently fall back to hardcoded data on read.
    const validation = SchedulesSchema.safeParse(merged);
    if (!validation.success) {
      console.error("[schedule/save] merged shape failed validation:");
      console.error(validation.error.format());
      return NextResponse.json<SaveErrorResponse>(
        {
          error: "validation_failed",
          detail: "The merged schedule did not match the expected shape.",
        },
        { status: 500 },
      );
    }

    // --- Write. RLS enforces school admin on UPDATE. ---
    const { error: updateError } = await supabase
      .from("schools")
      .update({ schedules: merged })
      .eq("id", school_id);

    if (updateError) {
      console.error("[schedule/save] update failed:", updateError);
      return NextResponse.json<SaveErrorResponse>(
        { error: "update_failed", detail: updateError.message },
        { status: 500 },
      );
    }

    const incomingCount = Object.keys(incomingDbShape).length;
    const totalCount = Object.keys(merged).length;

    console.log(
      `[schedule/save] success: user=${user.email ?? user.id}, school=${school_id}, saved=${incomingCount}, total=${totalCount}`,
    );

    return NextResponse.json<SaveSuccessResponse>({
      ok: true,
      school_id,
      variants_saved: incomingCount,
      variants_total: totalCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown_error";
    console.error("[schedule/save] top-level error:", err);
    return NextResponse.json<SaveErrorResponse>(
      { error: "server_error", detail: message },
      { status: 500 },
    );
  }
}

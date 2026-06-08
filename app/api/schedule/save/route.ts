import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/src/lib/supabase-server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import {
  translateToDbShape,
  mergeSchedules,
  TranslationError,
  type ExtractedSchedule,
} from "@/src/lib/schedule-shape";
import { SchedulesSchema, type Schedules } from "@/src/lib/schedules-schema";
import { writeAuditLog } from "@/src/lib/audit-log";
import { getCurrentActAsSession } from "@/src/lib/act-as-current";

// "merge"   → union the incoming variants over the existing ones (PDF-upload
//             flow: a partial upload must not clobber other variants).
// "replace" → write the incoming set as the school's entire schedule (full-edit
//             flow: a variant the admin deleted in the editor must disappear).
type SaveMode = "merge" | "replace";

interface SaveRequestBody {
  school_id: string;
  schedule: ExtractedSchedule;
  mode?: SaveMode;
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

function isValidEnvelope(body: unknown): body is SaveRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.school_id !== "string" || b.school_id.length === 0) return false;
  if (!b.schedule || typeof b.schedule !== "object") return false;
  if (b.mode !== undefined && b.mode !== "merge" && b.mode !== "replace") {
    return false;
  }
  return true;
}

/**
 * Build a service-role Supabase client that bypasses RLS.
 *
 * Why: the existence check + UPDATE in this route need to act on schools the
 * user admins, which may not be the school they teach at. RLS scopes teacher
 * SELECTs to their own school, so a Site Admin who teaches at PGHS but admins
 * COHS would hit a false 404 when saving to COHS.
 *
 * Authorization is verified by is_school_admin() above. Bypassing RLS for the
 * internal lookups is safe because we've already checked admin scope.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createSbClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // --- Auth: who is the caller? ---
    const userClient = await createUserClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    if (!user) {
      return NextResponse.json<SaveErrorResponse>(
        { error: "not_authenticated", detail: "You must be signed in." },
        { status: 401 },
      );
    }

    // --- Envelope check. ---
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json<SaveErrorResponse>(
        { error: "invalid_json", detail: "Request body was not valid JSON." },
        { status: 400 },
      );
    }

    if (!isValidEnvelope(body)) {
      return NextResponse.json<SaveErrorResponse>(
        {
          error: "invalid_request",
          detail: "Request must have school_id and schedule.",
        },
        { status: 400 },
      );
    }

    const { school_id, schedule } = body;
    const mode: SaveMode = body.mode ?? "merge";

    // --- Authorization: must be admin of this school. ---
    // Runs as the user (not service role) so auth.uid() inside is_school_admin
    // resolves to the caller.
    const { data: adminCheck, error: adminError } = await userClient.rpc(
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

    let authorized = adminCheck === true;

    // role_assignments site_admin: the modern source of truth for school admins
    // (the legacy school_admins table that is_school_admin() reads is being
    // retired). A site_admin provisioned via role_assignments — with no
    // school_admins row — must still be able to edit their school's schedule.
    // has_role() resolves through effective_user_id(), so act-as scopes correctly.
    if (!authorized) {
      const { data: siteAdminCheck, error: siteAdminError } =
        await userClient.rpc("has_role", {
          p_role: "site_admin",
          p_school_id: school_id,
        });
      if (siteAdminError) {
        console.error("[schedule/save] has_role(site_admin) failed:", siteAdminError);
        return NextResponse.json<SaveErrorResponse>(
          { error: "auth_check_failed", detail: siteAdminError.message },
          { status: 500 },
        );
      }
      authorized = siteAdminCheck === true;
    }

    // Founder-implicit edit: a founder can manage any school's bell schedule
    // even without an explicit school_admins row (matches their authority
    // elsewhere and unblocks the "founder onboards a new school" flow). Like
    // is_school_admin, has_role() resolves through effective_user_id(), so an
    // active act-as session correctly scopes this to the target's authority.
    if (!authorized) {
      const { data: founderCheck, error: founderError } = await userClient.rpc(
        "has_role",
        { p_role: "founder" },
      );
      if (founderError) {
        console.error("[schedule/save] has_role RPC failed:", founderError);
        return NextResponse.json<SaveErrorResponse>(
          { error: "auth_check_failed", detail: founderError.message },
          { status: 500 },
        );
      }
      authorized = founderCheck === true;
    }

    if (!authorized) {
      return NextResponse.json<SaveErrorResponse>(
        { error: "forbidden", detail: "You are not an admin of this school." },
        { status: 403 },
      );
    }

    // --- Past this line: service-role client (RLS bypassed). ---
    const serviceClient = getServiceClient();

    // --- Fetch existing schedule for merge. ---
    const { data: existingRow, error: fetchError } = await serviceClient
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
    let incomingDbShape: NonNullable<Schedules>;
    try {
      incomingDbShape = translateToDbShape(schedule);
    } catch (err) {
      if (err instanceof TranslationError) {
        return NextResponse.json<SaveErrorResponse>(
          { error: "invalid_schedule", detail: err.message },
          { status: 400 },
        );
      }
      throw err;
    }

    // In "replace" mode the incoming set IS the school's whole schedule, so
    // deletions the admin made in the editor stick. In "merge" mode we union
    // over what's already there. Both paths validate the final shape below.
    const existingSchedules = (existingRow.schedules as Schedules) ?? null;
    const merged =
      mode === "replace"
        ? incomingDbShape
        : mergeSchedules(existingSchedules, incomingDbShape);

    // --- Validate final shape. ---
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

    // --- Write. Service role bypasses RLS; we've already verified admin. ---
    const { error: updateError } = await serviceClient
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

    // Audit the schedule edit. This write goes through the service-role client,
    // so the schools AFTER-UPDATE trigger (migration 032) no-ops on it — we
    // record it here with known-actor attribution instead. Best-effort: a
    // failed audit write logs but never fails the save (see writeAuditLog).
    //
    // Stamp act-as attribution to match the DB triggers (029/032): record the
    // real actor and, when an act-as session is open, the user being acted as.
    const actAs = await getCurrentActAsSession();
    await writeAuditLog(serviceClient, {
      actor_user_id: user.id,
      acting_as_user_id: actAs?.target_user_id ?? null,
      break_glass: actAs?.break_glass ?? false,
      action: "schedule.update",
      target_table: "schools",
      target_id: school_id,
      before: existingSchedules,
      after: merged,
      reason: `mode=${mode}`,
    });

    const incomingCount = Object.keys(incomingDbShape).length;
    const totalCount = Object.keys(merged).length;

    console.log(
      `[schedule/save] success: user=${user.email ?? user.id}, school=${school_id}, mode=${mode}, saved=${incomingCount}, total=${totalCount}`,
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

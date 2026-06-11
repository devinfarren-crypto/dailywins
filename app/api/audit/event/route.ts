import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

// Client-initiated audit endpoint. Designed to be called fire-and-forget
// AFTER a successful client-side write (score save, note CRUD, etc.).
//
// Records an audit_log row ONLY when the caller has an active act_as_session.
// Non-act-as writes (the common case — a teacher saving their own scores)
// are silently dropped so audit_log doesn't grow on every classroom tap.
//
// This trade-off matches v1 of docs/ACT_AS_DESIGN_v1.md ("compliance pitch
// needs what the actor did under act-as"). v1.5 may flip to a Postgres
// trigger so coverage is guaranteed regardless of client behavior.

const EventSchema = z.object({
  action: z.string().min(1).max(64),
  target_table: z.string().min(1).max(64).optional(),
  target_id: z.string().uuid().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid event" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // nps_record.print is audited UNCONDITIONALLY (not act-as-gated): the
  // director's PDF export is a copy of student records leaving the audited
  // surface, so the chain of custody must show it. Permission re-checked via
  // is_nps_school_admin (runs as the caller).
  if (parsed.data.action === "nps_record.print") {
    if (!parsed.data.target_id) {
      return NextResponse.json({ error: "target_id required" }, { status: 400 });
    }
    const { data: st } = await admin
      .from("students")
      .select("school_id")
      .eq("id", parsed.data.target_id)
      .maybeSingle();
    const { data: isDirector } = st?.school_id
      ? await supabase.rpc("is_nps_school_admin", { p_school_id: st.school_id })
      : { data: false };
    if (isDirector !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await writeAuditLog(admin, {
      actor_user_id: user.id,
      action: "nps_record.print",
      target_table: "students",
      target_id: parsed.data.target_id,
    });
    return NextResponse.json({ ok: true, audited: true });
  }

  // Only audit if the caller is currently act-as'd. Otherwise drop silently.
  const { data: session } = await admin
    .from("act_as_sessions")
    .select("target_user_id, break_glass")
    .eq("actor_user_id", user.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ ok: true, audited: false });
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    acting_as_user_id: session.target_user_id,
    action: parsed.data.action,
    target_table: parsed.data.target_table ?? null,
    target_id: parsed.data.target_id ?? null,
    before: parsed.data.before,
    after: parsed.data.after,
    break_glass: session.break_glass,
  });

  return NextResponse.json({ ok: true, audited: true });
}

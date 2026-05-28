import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

// Ends the caller's currently-open act-as session (regular or break-glass).
// Idempotent: returns 404 if there's nothing to end.

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: openSession } = await admin
    .from("act_as_sessions")
    .select("id, target_user_id, break_glass")
    .eq("actor_user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (!openSession) {
    return NextResponse.json(
      { error: "No active act-as session" },
      { status: 404 }
    );
  }

  const endedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("act_as_sessions")
    .update({ ended_at: endedAt })
    .eq("id", openSession.id);

  if (updateError) {
    console.error("act_as.end update failed", updateError);
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    acting_as_user_id: openSession.target_user_id,
    action: openSession.break_glass ? "break_glass.end" : "act_as.end",
    target_table: "act_as_sessions",
    target_id: openSession.id,
    break_glass: openSession.break_glass,
    after: { ended_at: endedAt },
  });

  return NextResponse.json({ ok: true, ended_at: endedAt });
}

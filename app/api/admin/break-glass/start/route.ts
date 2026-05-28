import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { canBreakGlass } from "@/src/lib/act-as-scope";
import { writeAuditLog } from "@/src/lib/audit-log";

// Founder break-glass: act-as any role (including other founders/admins)
// with a required reason and a 15-minute hard timeout. Different from regular
// act-as in three ways: (1) reason is mandatory, (2) target need not be a
// Teacher, (3) audit row is marked break_glass=true.

const BreakGlassSchema = z.object({
  target_user_id: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is required for break-glass"),
});

const BREAK_GLASS_MINUTES = 15;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BreakGlassSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { target_user_id, reason } = parsed.data;

  const admin = createAdminClient();

  const auth = await canBreakGlass(admin, user.id, target_user_id);
  if (!auth.allowed) {
    return NextResponse.json(
      { error: auth.reason ?? "Forbidden" },
      { status: 403 }
    );
  }

  // Same concurrency rules as regular act-as.
  const { data: existingActorSession } = await admin
    .from("act_as_sessions")
    .select("id")
    .eq("actor_user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();
  if (existingActorSession) {
    return NextResponse.json(
      { error: "You already have an active session; exit it first." },
      { status: 409 }
    );
  }

  const { data: existingTargetSession } = await admin
    .from("act_as_sessions")
    .select("id")
    .eq("target_user_id", target_user_id)
    .is("ended_at", null)
    .maybeSingle();
  if (existingTargetSession) {
    return NextResponse.json(
      { error: "Another session is targeting this user." },
      { status: 409 }
    );
  }

  const expiresAt = new Date(
    Date.now() + BREAK_GLASS_MINUTES * 60 * 1000
  ).toISOString();

  const { data: session, error: insertError } = await admin
    .from("act_as_sessions")
    .insert({
      actor_user_id: user.id,
      target_user_id,
      expires_at: expiresAt,
      break_glass: true,
      reason,
    })
    .select("id, started_at, expires_at")
    .single();

  if (insertError || !session) {
    console.error("break_glass.start insert failed", insertError);
    return NextResponse.json(
      { error: insertError?.message ?? "Unable to start session" },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    acting_as_user_id: target_user_id,
    action: "break_glass.start",
    target_table: "act_as_sessions",
    target_id: session.id,
    reason,
    break_glass: true,
    after: { expires_at: session.expires_at },
  });

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    started_at: session.started_at,
    expires_at: session.expires_at,
  });
}

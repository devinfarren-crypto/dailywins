import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { canActAs } from "@/src/lib/act-as-scope";
import { writeAuditLog } from "@/src/lib/audit-log";

// Regular (non-break-glass) act-as session. 60-minute initial window;
// inactivity-based renewal happens in middleware on each request (TODO).

const StartSchema = z.object({
  target_user_id: z.string().uuid(),
});

const REGULAR_SESSION_MINUTES = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = StartSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { target_user_id } = parsed.data;

  const admin = createAdminClient();

  // Authority check (founder/D-A/S-A → Teacher within scope).
  const scope = await canActAs(admin, user.id, target_user_id);
  if (!scope.allowed) {
    return NextResponse.json(
      { error: scope.reason ?? "Forbidden" },
      { status: 403 }
    );
  }

  // Concurrency: caller must not already have an open session, and the
  // target must not already be the subject of one. The unique partial
  // indexes on act_as_sessions enforce this at the DB layer too, but a
  // clean check up front gives a clearer error than a constraint violation.
  const { data: existingActorSession } = await admin
    .from("act_as_sessions")
    .select("id")
    .eq("actor_user_id", user.id)
    .is("ended_at", null)
    .maybeSingle();
  if (existingActorSession) {
    return NextResponse.json(
      { error: "You already have an active act-as session; exit it first." },
      { status: 409 }
    );
  }

  const { data: existingTargetSession } = await admin
    .from("act_as_sessions")
    .select("id, actor_user_id")
    .eq("target_user_id", target_user_id)
    .is("ended_at", null)
    .maybeSingle();
  if (existingTargetSession) {
    return NextResponse.json(
      { error: "Another admin is currently acting as this teacher." },
      { status: 409 }
    );
  }

  const expiresAt = new Date(
    Date.now() + REGULAR_SESSION_MINUTES * 60 * 1000
  ).toISOString();

  const { data: session, error: insertError } = await admin
    .from("act_as_sessions")
    .insert({
      actor_user_id: user.id,
      target_user_id,
      expires_at: expiresAt,
      break_glass: false,
    })
    .select("id, started_at, expires_at")
    .single();

  if (insertError || !session) {
    console.error("act_as.start insert failed", insertError);
    return NextResponse.json(
      { error: insertError?.message ?? "Unable to start session" },
      { status: 500 }
    );
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    acting_as_user_id: target_user_id,
    action: "act_as.start",
    target_table: "act_as_sessions",
    target_id: session.id,
    after: {
      tier: scope.tier,
      expires_at: session.expires_at,
    },
  });

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    started_at: session.started_at,
    expires_at: session.expires_at,
    tier: scope.tier,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

const DenySchema = z.object({
  request_id: z.string().uuid(),
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

  const { data: isFounder, error: roleError } = await supabase.rpc("has_role", {
    p_role: "founder",
  });
  if (roleError) {
    console.error("Failed to verify founder role", roleError);
    return NextResponse.json({ error: "Unable to verify role" }, { status: 500 });
  }
  if (!isFounder) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DenySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  // Founder UPDATE is allowed by RLS — run through the session client so
  // reviewed_by lands on the founder's auth.uid().
  const { data, error } = await supabase
    .from("access_requests")
    .update({
      status: "denied",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", parsed.data.request_id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to deny access request", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Request not found or already reviewed" },
      { status: 404 }
    );
  }

  const admin = createAdminClient();
  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "access_request.deny",
    target_table: "access_requests",
    target_id: parsed.data.request_id,
  });

  return NextResponse.json({ ok: true });
}

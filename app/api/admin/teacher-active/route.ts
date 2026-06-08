import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

const Body = z.object({
  teacher_id: z.string().uuid(),
  active: z.boolean(),
});

// Founder or the teacher's site_admin deactivates / reactivates a teacher.
// set_teacher_active enforces scope internally; "deactivate, don't delete" —
// data is preserved, login is blocked, the action is reversible.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { teacher_id, active } = parsed.data;

  const { error } = await supabase.rpc("set_teacher_active", {
    p_teacher_id: teacher_id,
    p_active: active,
  });
  if (error) {
    console.error("set_teacher_active failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const admin = createAdminClient();
  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: active ? "teacher.reactivate" : "teacher.deactivate",
    target_table: "teachers",
    target_id: teacher_id,
    after: { active },
  });

  return NextResponse.json({ ok: true, active });
}

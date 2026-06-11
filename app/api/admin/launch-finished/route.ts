import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

// Marks the admin-home launch sequence finished for a school (052) so the
// steady-state view survives device changes. Site admin of that school only.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const schoolId = typeof body?.school_id === "string" ? body.school_id : null;
  if (!schoolId) {
    return NextResponse.json({ ok: false, error: "school_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: roleRow } = await admin
    .from("role_assignments")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("role", "site_admin")
    .eq("school_id", schoolId)
    .maybeSingle();
  if (!roleRow) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("schools")
    .update({ launch_finished_at: new Date().toISOString() })
    .eq("id", schoolId);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

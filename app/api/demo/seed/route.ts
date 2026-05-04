import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { seedDemoData } from "@/src/lib/demo-seed";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { data: teacher, error: teacherErr } = await supabase
      .from("teachers")
      .select("id, school_id")
      .eq("auth_id", user.id)
      .single();

    if (teacherErr || !teacher) {
      return NextResponse.json(
        { ok: false, error: "Teacher record not found" },
        { status: 404 }
      );
    }

    const admin = createAdminClient();
    const result = await seedDemoData(admin, teacher.id, teacher.school_id);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Demo seed failed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

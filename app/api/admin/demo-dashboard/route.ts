import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { seedDemoData, wipeDemoData } from "@/src/lib/demo-seed";
import { writeAuditLog } from "@/src/lib/audit-log";

// "What teachers see": gives a site admin / NPS director their own teacher
// dashboard at their school, pre-loaded with [DEMO]-tagged students, so they
// can learn the teacher experience hands-on before asking staff to use it.
//
// - If the caller has no teachers row, one is created at their admin school
//   with preferences.admin_first = true — that flag tells the post-auth
//   redirect to KEEP landing them on /admin/home (a real teacher's row, which
//   never carries the flag, still routes to /dashboard as always).
// - Re-running reseeds: seedDemoData wipes [DEMO] students at the school
//   first, so this is safe to click as many times as the director likes.
// - Body {action:"wipe"} removes the [DEMO] class everywhere (roster, records,
//   teacher dashboards) without reseeding — the "done exploring" button.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, school_id")
    .eq("user_id", user.id);
  const siteSchoolId = (roleRows ?? []).find((r) => r.role === "site_admin" && r.school_id)
    ?.school_id as string | undefined;
  if (!siteSchoolId) {
    return NextResponse.json(
      { ok: false, error: "Only school admins can open the demo dashboard." },
      { status: 403 }
    );
  }

  // The dashboard keys off the caller's teachers row — make sure one exists.
  const { data: existing } = await admin
    .from("teachers")
    .select("id, school_id, deactivated_at")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (existing?.deactivated_at) {
    return NextResponse.json({ ok: false, error: "This account is deactivated." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body?.action === "string" ? body.action : "seed";

  // Wipe: needs an existing teachers row (the demo created one); deletes every
  // [DEMO]-prefixed student at the school, cascading their scores/notes.
  if (action === "wipe") {
    if (!existing?.id) {
      return NextResponse.json({ ok: true, studentsDeleted: 0 });
    }
    try {
      const result = await wipeDemoData(admin, existing.id as string);
      await writeAuditLog(admin, {
        actor_user_id: user.id,
        action: "demo_dashboard.wipe",
        target_table: "teachers",
        target_id: existing.id as string,
        after: result,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Wipe failed";
      console.error("demo-dashboard wipe failed", err);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  let teacherId = existing?.id as string | undefined;
  let schoolId = (existing?.school_id as string | undefined) ?? siteSchoolId;
  let createdRow = false;
  if (!teacherId) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "Director";
    const { data: created, error: insertErr } = await admin
      .from("teachers")
      .insert({
        auth_id: user.id,
        school_id: siteSchoolId,
        full_name: fullName,
        email: user.email ?? "",
        preferences: { admin_first: true },
      })
      .select("id, school_id")
      .single();
    if (insertErr || !created) {
      return NextResponse.json(
        { ok: false, error: insertErr?.message ?? "Could not set up your dashboard." },
        { status: 500 }
      );
    }
    teacherId = created.id as string;
    schoolId = created.school_id as string;
    createdRow = true;
  }

  try {
    const result = await seedDemoData(admin, teacherId, schoolId);
    await writeAuditLog(admin, {
      actor_user_id: user.id,
      action: "demo_dashboard.seed",
      target_table: "teachers",
      target_id: teacherId,
      after: { ...result, teacher_row_created: createdRow },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Demo setup failed";
    console.error("demo-dashboard seed failed", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

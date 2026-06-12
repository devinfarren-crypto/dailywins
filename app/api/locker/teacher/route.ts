import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

// Teacher side of The Locker: activate it for your class (generates combos
// for the roster + a class code for the locker link), read slips/balances,
// and make audited wallet adjustments. Auth = the signed-in teacher's own
// row; everything is scoped to their roster.

async function getTeacher(admin: ReturnType<typeof createAdminClient>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, school_id, preferences, deactivated_at")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!teacher || teacher.deactivated_at) return null;
  return { user, teacher };
}

function newCombo(used: Set<string>): string {
  // Three numbers 0–39, like a real Master lock. Unique within the class.
  for (let i = 0; i < 1000; i++) {
    const c = [0, 0, 0]
      .map(() => String(Math.floor(Math.random() * 40)).padStart(2, "0"))
      .join("-");
    if (!used.has(c)) {
      used.add(c);
      return c;
    }
  }
  throw new Error("combo space exhausted");
}

export async function GET() {
  const admin = createAdminClient();
  const ctx = await getTeacher(admin);
  if (!ctx) return NextResponse.json({ ok: false, error: "not_teacher" }, { status: 403 });

  const lockerCfg = (ctx.teacher.preferences as {
    locker?: { enabled?: boolean; rate?: number; class_code?: string; activated_at?: string };
  } | null)?.locker;
  if (!lockerCfg?.enabled) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  const { data: identities } = await admin
    .from("locker_identities")
    .select("student_id, combo, claimed_at, students(display_name, archived_at)")
    .eq("teacher_id", ctx.teacher.id);

  const rows = (identities ?? [])
    .filter((r) => !(r.students as { archived_at?: string | null } | null)?.archived_at)
    .map((r) => ({
      student_id: r.student_id,
      display_name: (r.students as { display_name?: string } | null)?.display_name ?? "Student",
      combo: r.combo,
      claimed: Boolean(r.claimed_at),
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));

  // Wallet balances per canonical student.
  const ids = rows.map((r) => r.student_id as string);
  const balances = new Map<string, number>();
  if (ids.length > 0) {
    const { data: ledger } = await admin
      .from("points_ledger")
      .select("student_id, amount")
      .in("student_id", ids);
    for (const l of ledger ?? []) {
      balances.set(l.student_id as string, (balances.get(l.student_id as string) ?? 0) + (l.amount as number));
    }
  }

  return NextResponse.json({
    ok: true,
    enabled: true,
    class_code: lockerCfg.class_code,
    rate: lockerCfg.rate ?? 1,
    activated_at: lockerCfg.activated_at,
    students: rows.map((r) => ({ ...r, balance: balances.get(r.student_id as string) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const ctx = await getTeacher(admin);
  if (!ctx) return NextResponse.json({ ok: false, error: "not_teacher" }, { status: 403 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "activate") {
    const prefs = (ctx.teacher.preferences ?? {}) as Record<string, unknown>;
    const existing = prefs.locker as { class_code?: string } | undefined;
    const classCode = existing?.class_code ?? randomBytes(9).toString("base64url");
    const lockerCfg = {
      enabled: true,
      rate: 1,
      class_code: classCode,
      activated_at: new Date().toISOString(),
    };
    await admin
      .from("teachers")
      .update({ preferences: { ...prefs, locker: lockerCfg } })
      .eq("id", ctx.teacher.id);

    // Combos for every active, non-demo roster student who lacks one.
    const { data: roster } = await admin
      .from("students")
      .select("id, display_name, canonical_id")
      .eq("school_id", ctx.teacher.school_id)
      .is("archived_at", null)
      .not("display_name", "like", "[DEMO] %");
    const { data: existingIds } = await admin
      .from("locker_identities")
      .select("student_id, combo")
      .eq("teacher_id", ctx.teacher.id);
    const have = new Set((existingIds ?? []).map((r) => r.student_id as string));
    const used = new Set((existingIds ?? []).map((r) => r.combo as string));
    const inserts = (roster ?? [])
      .filter((s) => !have.has(s.id as string))
      .map((s) => ({
        student_id: s.id as string,
        teacher_id: ctx.teacher.id as string,
        combo: newCombo(used),
      }));
    if (inserts.length > 0) {
      const { error } = await admin.from("locker_identities").insert(inserts);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }
    await writeAuditLog(admin, {
      actor_user_id: ctx.user.id,
      action: "locker.activate",
      target_table: "teachers",
      target_id: ctx.teacher.id as string,
      after: { class_code: classCode, combos_created: inserts.length },
    });
    return NextResponse.json({ ok: true, class_code: classCode, combos_created: inserts.length });
  }

  if (action === "set_rate") {
    const rate = typeof body.rate === "number" ? body.rate : NaN;
    if (!(rate >= 0.5 && rate <= 2)) {
      return NextResponse.json({ ok: false, error: "rate must be 0.5–2" }, { status: 400 });
    }
    const prefs = (ctx.teacher.preferences ?? {}) as Record<string, unknown>;
    const lockerCfg = { ...(prefs.locker as object), rate };
    await admin.from("teachers").update({ preferences: { ...prefs, locker: lockerCfg } }).eq("id", ctx.teacher.id);
    await writeAuditLog(admin, {
      actor_user_id: ctx.user.id,
      action: "locker.set_rate",
      target_table: "teachers",
      target_id: ctx.teacher.id as string,
      after: { rate },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "adjust") {
    const studentId = typeof body.student_id === "string" ? body.student_id : "";
    const amount = typeof body.amount === "number" ? Math.trunc(body.amount) : 0;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!studentId || amount === 0 || reason.length < 3) {
      return NextResponse.json({ ok: false, error: "student, non-zero amount, and a reason required" }, { status: 400 });
    }
    // Scope check: the student must hold a locker identity in THIS class.
    const { data: owned } = await admin
      .from("locker_identities")
      .select("id")
      .eq("teacher_id", ctx.teacher.id)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!owned) return NextResponse.json({ ok: false, error: "not your student" }, { status: 403 });

    const { error } = await admin.from("points_ledger").insert({
      student_id: studentId,
      entry_type: "adjustment",
      amount,
      ref: { kind: "teacher_adjustment", reason },
      created_by: ctx.user.id,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

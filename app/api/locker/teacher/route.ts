import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";
import { SHELF_TEMPLATE_BY_ID, shelfLabel } from "@/src/lib/locker/shelf";

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

  // Shelf: redemptions waiting on this teacher, surfaced at the top of /locker/manage.
  const nameById = new Map(rows.map((r) => [r.student_id as string, r.display_name]));
  const { data: pending } = await admin
    .from("shelf_items")
    .select("id, student_id, template_id, custom_label, requested_at")
    .eq("granted_by", ctx.teacher.id)
    .eq("status", "pending_redemption")
    .order("requested_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    enabled: true,
    class_code: lockerCfg.class_code,
    rate: lockerCfg.rate ?? 1,
    activated_at: lockerCfg.activated_at,
    students: rows.map((r) => ({ ...r, balance: balances.get(r.student_id as string) ?? 0 })),
    shelf_pending: (pending ?? []).map((p) => ({
      id: p.id,
      student_name: nameById.get(p.student_id as string) ?? "Student",
      label: shelfLabel(p.template_id as string, p.custom_label as string | null),
      requested_at: p.requested_at,
    })),
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

    // Combos for every active roster student who lacks one. [DEMO] students
    // ARE included — the locker is part of the demo story ("here's what Ava
    // sees"), and a demo wipe cascades cleanly through locker_identities,
    // points_ledger, inventory, and layouts, so nothing orphans.
    const { data: roster } = await admin
      .from("students")
      .select("id, display_name, canonical_id")
      .eq("school_id", ctx.teacher.school_id)
      .is("archived_at", null);
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

  if (action === "shelf_grant") {
    const templateId = typeof body.template_id === "string" ? body.template_id : "";
    if (!SHELF_TEMPLATE_BY_ID.has(templateId as never)) {
      return NextResponse.json({ ok: false, error: "unknown_template" }, { status: 400 });
    }
    const customLabel =
      templateId === "custom" && typeof body.custom_label === "string"
        ? body.custom_label.trim().slice(0, 40)
        : null;
    if (templateId === "custom" && !customLabel) {
      return NextResponse.json({ ok: false, error: "custom needs a label" }, { status: 400 });
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) || null : null;

    // Resolve targets: explicit ids, or every student with a locker identity
    // in this class. Either way, scope = THIS teacher's locker_identities.
    const { data: identities } = await admin
      .from("locker_identities")
      .select("student_id")
      .eq("teacher_id", ctx.teacher.id);
    const classIds = new Set((identities ?? []).map((r) => r.student_id as string));
    const requested = Array.isArray(body.student_ids)
      ? (body.student_ids as unknown[]).filter((s): s is string => typeof s === "string")
      : [];
    const targets = body.student_ids === "all" ? [...classIds] : requested.filter((s) => classIds.has(s));
    if (targets.length === 0) {
      return NextResponse.json({ ok: false, error: "no students selected" }, { status: 400 });
    }

    const { error } = await admin.from("shelf_items").insert(
      targets.map((student_id) => ({
        student_id,
        granted_by: ctx.teacher.id,
        template_id: templateId,
        custom_label: customLabel,
        note,
      }))
    );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    await writeAuditLog(admin, {
      actor_user_id: ctx.user.id,
      action: "locker.shelf_grant",
      target_table: "shelf_items",
      target_id: ctx.teacher.id as string,
      after: { template_id: templateId, custom_label: customLabel, students: targets.length },
    });
    return NextResponse.json({ ok: true, granted: targets.length });
  }

  if (action === "shelf_confirm" || action === "shelf_return" || action === "shelf_revoke") {
    const itemId = typeof body.id === "string" ? body.id : "";
    const { data: item } = await admin
      .from("shelf_items")
      .select("id, status, template_id, student_id")
      .eq("id", itemId)
      .eq("granted_by", ctx.teacher.id) // only the granting teacher manages it
      .maybeSingle();
    if (!item) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const update =
      action === "shelf_confirm"
        ? { status: "redeemed", redeemed_at: new Date().toISOString() }
        : action === "shelf_return"
          ? { status: "granted", requested_at: null }
          : { status: "revoked" };
    if ((action === "shelf_confirm" || action === "shelf_return") && item.status !== "pending_redemption") {
      return NextResponse.json({ ok: false, error: "not_pending" }, { status: 409 });
    }
    const { error } = await admin.from("shelf_items").update(update).eq("id", itemId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (action === "shelf_confirm") {
      await writeAuditLog(admin, {
        actor_user_id: ctx.user.id,
        action: "locker.shelf_redeem",
        target_table: "shelf_items",
        target_id: itemId,
        after: { template_id: item.template_id },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

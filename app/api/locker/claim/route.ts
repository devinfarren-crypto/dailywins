import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { LOCKER_COOKIE, LOCKER_COOKIE_MAX_AGE } from "@/src/lib/locker/session";
import { STARTER_ITEMS, WELCOME_GRANT } from "@/src/lib/locker/schema";

// The combo moment: class code (from the locker link) + the student's
// 3-number combo slip → claims the locker on this device. First claim also
// seeds the starter kit and the one-time welcome grant (decision #4).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const comboRaw = typeof body.combo === "string" ? body.combo : "";
  if (!/^[A-Za-z0-9_-]{8,16}$/.test(code) || !/^\d{2}-\d{2}-\d{2}$/.test(normalize(comboRaw))) {
    return NextResponse.json({ ok: false, error: "bad_combo" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Class code → activating teacher.
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, preferences")
    .filter("preferences->locker->>class_code", "eq", code)
    .maybeSingle();
  const locker = (teacher?.preferences as { locker?: { enabled?: boolean } } | null)?.locker;
  if (!teacher || locker?.enabled !== true) {
    return NextResponse.json({ ok: false, error: "unknown_class" }, { status: 404 });
  }

  const { data: identity } = await admin
    .from("locker_identities")
    .select("id, student_id, claim_secret, claimed_at, device_count")
    .eq("teacher_id", teacher.id)
    .eq("combo", normalize(comboRaw))
    .maybeSingle();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "wrong_combo" }, { status: 403 });
  }

  if (!identity.claimed_at) {
    // First open: starter kit + welcome grant, then mark claimed.
    const canonicalId = await canonical(admin, identity.student_id as string);
    await admin.from("points_ledger").insert({
      student_id: canonicalId,
      entry_type: "earn",
      amount: WELCOME_GRANT,
      ref: { kind: "welcome_grant" },
    });
    // UNIQUE(student_id, item_id) exists (053) — onConflict is safe here.
    await admin.from("student_inventory").upsert(
      STARTER_ITEMS.map((i) => ({
        student_id: canonicalId,
        item_id: i.id,
        acquired_via: "starter",
      })),
      { onConflict: "student_id,item_id", ignoreDuplicates: true }
    );
    await admin
      .from("locker_identities")
      .update({ claimed_at: new Date().toISOString(), device_count: 1 })
      .eq("id", identity.id);
  } else {
    await admin
      .from("locker_identities")
      .update({ device_count: (identity.device_count ?? 0) + 1 })
      .eq("id", identity.id);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOCKER_COOKIE, identity.claim_secret as string, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: LOCKER_COOKIE_MAX_AGE,
  });
  return res;
}

function normalize(combo: string): string {
  return combo
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((n) => n.padStart(2, "0"))
    .join("-");
}

async function canonical(admin: ReturnType<typeof createAdminClient>, studentId: string) {
  const { data } = await admin
    .from("students")
    .select("id, canonical_id")
    .eq("id", studentId)
    .maybeSingle();
  return (data?.canonical_id ?? data?.id ?? studentId) as string;
}

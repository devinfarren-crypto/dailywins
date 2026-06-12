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

    // Demo students claim into an ASPIRATIONAL locker, not an empty one —
    // the first impression in a director demo is the fully-lived-in door.
    const { data: stu } = await admin
      .from("students")
      .select("display_name")
      .eq("id", identity.student_id)
      .maybeSingle();
    if (stu?.display_name?.startsWith("[DEMO] ")) {
      await admin.from("student_inventory").upsert(
        DEMO_SHOWCASE.map((i) => ({
          student_id: canonicalId,
          item_id: i,
          acquired_via: "grant",
        })),
        { onConflict: "student_id,item_id", ignoreDuplicates: true }
      );
      await admin.from("locker_layouts").upsert({
        student_id: canonicalId,
        layout: DEMO_LAYOUT,
        updated_at: new Date().toISOString(),
      });
    }

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

// The demo showcase: items granted to [DEMO] students + a layered, slightly
// chaotic layout so a director's first look is the aspiration.
const DEMO_SHOWCASE = [
  "bg-grid-horizon",
  "stk-px-bitt",
  "stk-px-heart",
  "stk-px-coin",
  "stk-boombox",
  "stk-cassette",
  "stk-mx-nowplaying",
  "stk-holo-saturn",
  "btn-have-nice-day",
  "pat-roadtrip",
  "mir-chrome",
];

const DEMO_LAYOUT = {
  background: "bg-grid-horizon",
  items: [
    { item_id: "mir-chrome", x: 0.24, y: 0.33, z: 1, rot: 0 },
    { item_id: "stk-smiley", x: 0.13, y: 0.62, z: 3, rot: -9, scale: 0.85 },
    { item_id: "stk-px-heart", x: 0.34, y: 0.6, z: 4, rot: 7 },
    { item_id: "stk-px-coin", x: 0.2, y: 0.77, z: 5, rot: -4, scale: 1.1 },
    { item_id: "stk-lightning", x: 0.4, y: 0.78, z: 2, rot: 14, scale: 0.7 },
    { item_id: "stk-px-bitt", x: 0.31, y: 0.14, z: 6, rot: -6, scale: 1.25 },
    { item_id: "btn-have-nice-day", x: 0.12, y: 0.18, z: 7, rot: 8, scale: 0.9 },
    { item_id: "stk-boombox", x: 0.72, y: 0.18, z: 3, rot: -3, scale: 1.2 },
    { item_id: "stk-mx-nowplaying", x: 0.86, y: 0.36, z: 4, rot: 5 },
    { item_id: "stk-cassette", x: 0.62, y: 0.42, z: 5, rot: -11, scale: 0.85 },
    { item_id: "stk-holo-saturn", x: 0.78, y: 0.58, z: 6, rot: 6, scale: 1.15 },
    { item_id: "pat-roadtrip", x: 0.6, y: 0.74, z: 7, rot: -5 },
    { item_id: "stk-star-gold", x: 0.88, y: 0.8, z: 8, rot: 12, scale: 0.7 },
    { item_id: "stk-peace", x: 0.68, y: 0.88, z: 2, rot: -8, scale: 0.65 },
  ],
};

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

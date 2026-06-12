import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity, canonicalGroupIds } from "@/src/lib/locker/session";
import { creditUncreditedDays, weekCategoryProgress } from "@/src/lib/locker/earn";
import { CATALOG, LayoutSchema } from "@/src/lib/locker/schema";
import { shelfLabel } from "@/src/lib/locker/shelf";

// The functional cards (Today, Goal, My Best Work, Month) are free and
// universal — granted lazily here so students claimed BEFORE the cards
// existed get them too.
const CARD_IDS = ["crd-today", "crd-goal", "crd-work", "crd-month"];

// Resolve today's bell-schedule variant: specific-date match wins, then
// day-of-week, then the first variant on file.
type Variant = {
  periods: { label: string; start: string; end: string; type?: string }[];
  days?: string[] | null;
  specific_dates?: string[] | null;
};
function todaysPeriods(schedules: Record<string, Variant> | null) {
  if (!schedules) return null;
  const entries = Object.entries(schedules);
  if (entries.length === 0) return null;
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][now.getDay()];
  const pick =
    entries.find(([, v]) => v.specific_dates?.includes(iso)) ??
    entries.find(([, v]) => v.days?.includes(dow)) ??
    entries[0];
  return {
    variant: pick[0],
    periods: (pick[1].periods ?? [])
      .filter((p) => p.type !== "non_student")
      .map((p) => ({ label: p.label, start: p.start, end: p.end, kind: p.type ?? "class" })),
  };
}

// Everything the locker UI needs in one read — and the lazy daily-earn
// credit happens here, so opening the locker is what mints yesterday's
// points (points-economy.md option B).
export async function GET() {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

  // Free universal cards — idempotent lazy grant.
  await admin.from("student_inventory").upsert(
    CARD_IDS.map((id) => ({ student_id: identity.studentId, item_id: id, acquired_via: "grant" })),
    { onConflict: "student_id,item_id", ignoreDuplicates: true }
  );

  // Lazy credit settled days for the activating class.
  const { data: teacher } = await admin
    .from("teachers")
    .select("preferences")
    .eq("id", identity.teacherId)
    .maybeSingle();
  const lockerCfg = (teacher?.preferences as {
    locker?: { enabled?: boolean; rate?: number; activated_at?: string };
  } | null)?.locker;
  if (lockerCfg?.enabled && lockerCfg.activated_at) {
    const groupIds = await canonicalGroupIds(admin, identity.studentId);
    await creditUncreditedDays(admin, {
      canonicalId: identity.studentId,
      groupIds,
      teacherId: identity.teacherId,
      rate: typeof lockerCfg.rate === "number" ? lockerCfg.rate : 1,
      activatedAt: lockerCfg.activated_at,
    });
  }

  const groupIdsForGoal = await canonicalGroupIds(admin, identity.studentId);

  // Redeemed shelf items keep their REDEEMED stamp for 5 days, then archive.
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400_000).toISOString();
  await admin
    .from("shelf_items")
    .update({ status: "archived" })
    .in("student_id", groupIdsForGoal)
    .eq("status", "redeemed")
    .lt("redeemed_at", fiveDaysAgo);

  const [{ data: ledger }, { data: inventory }, { data: layoutRow }, { data: schoolRow }, { data: shelfRows }, weekProgress] = await Promise.all([
    admin
      .from("points_ledger")
      .select("id, entry_type, amount, ref, created_at")
      .eq("student_id", identity.studentId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("student_inventory")
      .select("item_id, acquired_via")
      .eq("student_id", identity.studentId),
    admin
      .from("locker_layouts")
      .select("layout, updated_at")
      .eq("student_id", identity.studentId)
      .maybeSingle(),
    admin.from("schools").select("schedules").eq("id", identity.schoolId).maybeSingle(),
    admin
      .from("shelf_items")
      .select("id, template_id, custom_label, note, status, granted_at, redeemed_at, seen_at")
      .in("student_id", groupIdsForGoal)
      .in("status", ["granted", "pending_redemption", "redeemed"])
      .order("granted_at", { ascending: true }),
    weekCategoryProgress(admin, { groupIds: groupIdsForGoal, teacherId: identity.teacherId }),
  ]);

  const rows = ledger ?? [];
  // Balance + earned-all-time over the FULL ledger (the 100-row read above is
  // just for display). Plain select-and-sum is fine at classroom scale.
  const { data: allAmounts } = await admin
    .from("points_ledger")
    .select("entry_type, amount")
    .eq("student_id", identity.studentId);
  const balance = (allAmounts ?? []).reduce((s, r) => s + (r.amount as number), 0);
  const earnedAllTime = (allAmounts ?? [])
    .filter((r) => r.entry_type === "earn" || (r.entry_type === "adjustment" && (r.amount as number) > 0))
    .reduce((s, r) => s + (r.amount as number), 0);

  const layout = LayoutSchema.safeParse(layoutRow?.layout ?? { items: [], background: null });

  return NextResponse.json({
    ok: true,
    displayName: identity.displayName,
    balance,
    earnedAllTime,
    ledger: rows.slice(0, 40),
    inventory: (inventory ?? []).map((r) => r.item_id),
    layout: layout.success ? layout.data : { items: [], background: null },
    // Optimistic-concurrency baseline: a stale tab can never clobber a newer
    // arrangement (the save route rejects mismatched baselines).
    layoutVersion: layoutRow?.updated_at ?? null,
    catalogVersion: CATALOG.catalog_version,
    today: todaysPeriods((schoolRow?.schedules ?? null) as Record<string, Variant> | null),
    weekProgress,
    shelf: (shelfRows ?? []).map((r) => ({
      id: r.id,
      template_id: r.template_id,
      label: shelfLabel(r.template_id as string, r.custom_label as string | null),
      note: r.note ?? null,
      status: r.status,
      granted_at: r.granted_at,
      redeemed_at: r.redeemed_at ?? null,
      seen: Boolean(r.seen_at),
    })),
  });
}


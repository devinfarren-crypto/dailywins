import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity, canonicalGroupIds } from "@/src/lib/locker/session";
import { creditUncreditedDays } from "@/src/lib/locker/earn";
import { CATALOG, LayoutSchema } from "@/src/lib/locker/schema";

// Everything the locker UI needs in one read — and the lazy daily-earn
// credit happens here, so opening the locker is what mints yesterday's
// points (points-economy.md option B).
export async function GET() {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

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

  const [{ data: ledger }, { data: inventory }, { data: layoutRow }] = await Promise.all([
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
      .select("layout")
      .eq("student_id", identity.studentId)
      .maybeSingle(),
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
    catalogVersion: CATALOG.catalog_version,
  });
}


import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity } from "@/src/lib/locker/session";
import { CATALOG, CATALOG_BY_ID } from "@/src/lib/locker/schema";

// Buy one item at its posted catalog price. Price resolves server-side from
// the catalog (never trusted from the client); the money math is atomic in
// locker_purchase() (053) under an advisory lock — racing tabs can't
// double-spend.
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const itemId = typeof body.item_id === "string" ? body.item_id : "";
  const item = CATALOG_BY_ID.get(itemId);
  if (!item || item.retired || item.price <= 0) {
    return NextResponse.json({ ok: false, error: "not_for_sale" }, { status: 400 });
  }

  const { data, error } = await admin.rpc("locker_purchase", {
    p_student_id: identity.studentId,
    p_item_id: item.id,
    p_price: item.price,
    p_catalog_version: CATALOG.catalog_version,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const result = data as { ok: boolean; error?: string; balance?: number };
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}

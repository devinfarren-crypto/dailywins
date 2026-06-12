import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity } from "@/src/lib/locker/session";
import { LayoutSchema, CATALOG_BY_ID } from "@/src/lib/locker/schema";

// Save the door. Validates shape (Zod, mirroring the 30-item DB CHECK) and
// ownership: every placed item and the background must be in the student's
// inventory and exist in the catalog.
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

  const parsed = LayoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_layout" }, { status: 400 });
  }
  const layout = parsed.data;

  const { data: inv } = await admin
    .from("student_inventory")
    .select("item_id")
    .eq("student_id", identity.studentId);
  const owned = new Set((inv ?? []).map((r) => r.item_id as string));

  const placeable = layout.items.every(
    (p) => owned.has(p.item_id) && CATALOG_BY_ID.get(p.item_id)?.type !== "background"
  );
  const bgOk =
    layout.background === null ||
    (owned.has(layout.background) && CATALOG_BY_ID.get(layout.background)?.type === "background");
  const mirrors = layout.items.filter((p) => CATALOG_BY_ID.get(p.item_id)?.type === "mirror");
  if (!placeable || !bgOk || mirrors.length > 1) {
    return NextResponse.json({ ok: false, error: "not_owned" }, { status: 403 });
  }

  const { error } = await admin.from("locker_layouts").upsert({
    student_id: identity.studentId,
    layout,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

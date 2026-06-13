import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity } from "@/src/lib/locker/session";
import { LayoutSchema, CATALOG_BY_ID, isAllowedWorkUrl } from "@/src/lib/locker/schema";

// Save the door. Validates shape (Zod, mirroring the 30-item DB CHECK) and
// ownership: every placed item and the background must be in the student's
// inventory and exist in the catalog.
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { layout?: unknown }
    | null;
  const parsed = LayoutSchema.safeParse(body?.layout ?? body); // tolerate the old flat shape
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

  // Proud-work pointers: the host allowlist is enforced HERE, on every save —
  // the client check is just a friendly message. One check per placed card
  // (students may show off many assignments) plus the legacy layout slot.
  const workUrls = [
    ...(layout.work ? [layout.work.url] : []),
    ...layout.items.flatMap((p) => (p.work ? [p.work.url] : [])),
  ];
  if (workUrls.some((u) => !isAllowedWorkUrl(u))) {
    return NextResponse.json({ ok: false, error: "work_url_not_allowed" }, { status: 400 });
  }

  // Last-write-wins. A locker is ONE student decorating their own device, so
  // plain upsert is correct — and it avoids the trap that bit us before:
  // using a timestamptz string as a version token. Postgres serializes the
  // stored timestamp ("…123000+00:00") differently from the JS ISO string we
  // wrote ("…123Z"), so a baseline comparison 409'd on every second save and
  // the client's revert ate the edit (stickers snapped back, calendar marks
  // didn't hold). No version token, no false conflict.
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

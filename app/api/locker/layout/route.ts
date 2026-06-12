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
    | { layout?: unknown; baseline?: string | null }
    | null;
  const parsed = LayoutSchema.safeParse(body?.layout ?? body); // tolerate the old flat shape
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "bad_layout" }, { status: 400 });
  }
  const layout = parsed.data;
  const baseline = typeof body?.baseline === "string" ? body.baseline : body?.baseline === null ? null : undefined;

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

  // Proud-work pointer: the host allowlist is enforced HERE, on every save —
  // the client check is just a friendly message (functional-objects.md #3).
  if (layout.work && !isAllowedWorkUrl(layout.work.url)) {
    return NextResponse.json({ ok: false, error: "work_url_not_allowed" }, { status: 400 });
  }

  // Optimistic concurrency: a tab may only overwrite the version it loaded.
  // A stale tab (older baseline) gets a 409 and refetches instead of
  // clobbering a newer arrangement — multi-tab testing ate a layout once.
  if (baseline !== undefined) {
    const { data: current } = await admin
      .from("locker_layouts")
      .select("updated_at")
      .eq("student_id", identity.studentId)
      .maybeSingle();
    const currentVersion = current?.updated_at ?? null;
    if (currentVersion !== baseline) {
      return NextResponse.json(
        { ok: false, error: "stale", layoutVersion: currentVersion },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("locker_layouts").upsert({
    student_id: identity.studentId,
    layout,
    updated_at: now,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, layoutVersion: now });
}

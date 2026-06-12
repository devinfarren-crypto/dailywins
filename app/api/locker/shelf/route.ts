import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity, canonicalGroupIds } from "@/src/lib/locker/session";

// Student side of the teacher shelf. The ONLY transitions a student can make
// (teacher-shelf.md): granted → pending_redemption ("Use this"), and marking
// an item seen. Everything else belongs to the teacher route.
export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "no_locker_session" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string; action?: string } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const action = typeof body?.action === "string" ? body.action : "";
  if (!id || !["use", "seen"].includes(action)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // Ownership: the item must belong to this student's canonical group.
  const groupIds = await canonicalGroupIds(admin, identity.studentId);
  const { data: item } = await admin
    .from("shelf_items")
    .select("id, student_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!item || !groupIds.includes(item.student_id as string)) {
    return NextResponse.json({ ok: false, error: "not_yours" }, { status: 403 });
  }

  if (action === "seen") {
    await admin
      .from("shelf_items")
      .update({ seen_at: new Date().toISOString() })
      .eq("id", id)
      .is("seen_at", null);
    return NextResponse.json({ ok: true });
  }

  // action === "use"
  if (item.status !== "granted") {
    return NextResponse.json({ ok: false, error: "not_usable" }, { status: 409 });
  }
  const { error } = await admin
    .from("shelf_items")
    .update({ status: "pending_redemption", requested_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "granted"); // guard against a double-tap race
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

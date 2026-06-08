import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

const Body = z.object({ school_id: z.string().uuid().optional() });

// Site Admin (or Founder) generates a single-use invite link for a teacher at a
// school they administer. The link is shared out-of-band; the invitee signs in
// through it and is provisioned as a teacher (see redeem_invite, migration 036).
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, school_id")
    .eq("user_id", user.id);
  const roles = roleRows ?? [];
  const isFounder = roles.some((r) => r.role === "founder");
  const siteSchoolIds = roles
    .filter((r) => r.role === "site_admin" && r.school_id)
    .map((r) => r.school_id as string);

  // Resolve the school to invite into, scoped to what the caller administers.
  let schoolId = parsed.data.school_id;
  if (!isFounder) {
    if (siteSchoolIds.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!schoolId) {
      if (siteSchoolIds.length === 1) {
        schoolId = siteSchoolIds[0];
      } else {
        return NextResponse.json(
          { error: "Specify which school to invite to" },
          { status: 400 }
        );
      }
    } else if (!siteSchoolIds.includes(schoolId)) {
      return NextResponse.json(
        { error: "You don't administer that school" },
        { status: 403 }
      );
    }
  }
  if (!schoolId) {
    return NextResponse.json({ error: "school_id required" }, { status: 400 });
  }

  // Run as the caller so generate_invite's tier-rank check + created_by resolve
  // to them (a site_admin may invite the strictly-lower teacher tier).
  const { data: token, error } = await supabase.rpc("generate_invite", {
    p_role: "teacher",
    p_school_id: schoolId,
  });
  if (error) {
    console.error("generate_invite failed", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "invite.create",
    target_table: "invites",
    target_id: schoolId,
    after: { role: "teacher", school_id: schoolId },
  });

  return NextResponse.json({
    ok: true,
    invite_url: `${origin}/?invite=${token}`,
  });
}

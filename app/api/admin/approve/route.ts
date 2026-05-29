import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";

const ApproveSchema = z
  .object({
    request_id: z.string().uuid(),
    existing_school_id: z.string().uuid().optional(),
    new_school: z
      .object({
        name: z.string().trim().min(1, "School name is required"),
        district: z.string().trim().min(1, "District is required"),
      })
      .optional(),
  })
  .refine(
    (v) => Boolean(v.existing_school_id) !== Boolean(v.new_school),
    { message: "Provide either existing_school_id or new_school, not both" }
  );

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Founder gate — defense in depth (approve_access_request re-checks internally).
  const { data: isFounder, error: roleError } = await supabase.rpc("has_role", {
    p_role: "founder",
  });
  if (roleError) {
    console.error("Failed to verify founder role", roleError);
    return NextResponse.json({ error: "Unable to verify role" }, { status: 500 });
  }
  if (!isFounder) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ApproveSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { request_id, existing_school_id, new_school } = parsed.data;

  // schools.INSERT has no RLS policy — must use service role to create a new school.
  let schoolId = existing_school_id;
  if (!schoolId && new_school) {
    const admin = createAdminClient();
    const { data: created, error: schoolError } = await admin
      .from("schools")
      .insert({ name: new_school.name, district: new_school.district })
      .select("id")
      .single();
    if (schoolError || !created) {
      console.error("Failed to create school", schoolError);
      return NextResponse.json(
        { error: schoolError?.message ?? "Unable to create school" },
        { status: 500 }
      );
    }
    schoolId = created.id;
  }

  if (!schoolId) {
    return NextResponse.json({ error: "School is required" }, { status: 400 });
  }

  // Call RPC via the user's session so internal has_role('founder') + auth.uid()
  // (used for reviewed_by / created_by) resolve to the founder, not the service role.
  const { data: teacherId, error: rpcError } = await supabase.rpc(
    "approve_access_request",
    { p_request_id: request_id, p_school_id: schoolId }
  );

  if (rpcError) {
    console.error("approve_access_request failed", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const admin = createAdminClient();
  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "access_request.approve",
    target_table: "access_requests",
    target_id: request_id,
    after: {
      teacher_id: teacherId,
      school_id: schoolId,
      created_new_school: Boolean(new_school),
    },
  });

  return NextResponse.json({
    ok: true,
    teacher_id: teacherId,
    school_id: schoolId,
  });
}

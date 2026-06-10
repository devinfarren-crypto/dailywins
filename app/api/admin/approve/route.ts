import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";
import { createWelcomeLink } from "@/src/lib/welcome-link";
import { sendApprovalEmail } from "@/src/lib/send-approval-email";

// role defaults to "teacher" so existing callers and the common case keep
// working unchanged. teacher/site_admin are school-scoped; district_admin is
// district-scoped (no school).
const ApproveSchema = z
  .object({
    request_id: z.string().uuid(),
    role: z.enum(["teacher", "site_admin", "district_admin"]).default("teacher"),
    existing_school_id: z.string().uuid().optional(),
    new_school: z
      .object({
        name: z.string().trim().min(1, "School name is required"),
        district: z.string().trim().min(1, "District is required"),
      })
      .optional(),
    district_id: z.string().uuid().optional(),
  })
  .refine(
    (v) =>
      v.role === "district_admin"
        ? Boolean(v.district_id) && !v.existing_school_id && !v.new_school
        : Boolean(v.existing_school_id) !== Boolean(v.new_school),
    {
      message:
        "Teacher / site admin need a school; district admin needs a district",
    }
  );

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
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
  const { request_id, role, existing_school_id, new_school, district_id } =
    parsed.data;

  // Resolve scope. district_admin is district-scoped; teacher/site_admin are
  // school-scoped (and may create a new school inline).
  let schoolId: string | undefined = undefined;
  if (role !== "district_admin") {
    schoolId = existing_school_id;
    // schools.INSERT has no RLS policy — must use service role to create one.
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
  }

  // Call RPC via the user's session so internal has_role('founder') + auth.uid()
  // (used for reviewed_by / created_by) resolve to the founder, not the service role.
  const { data: result, error: rpcError } = await supabase.rpc(
    "approve_access_request_as_role",
    {
      p_request_id: request_id,
      p_role: role,
      p_school_id: schoolId ?? null,
      p_district_id: role === "district_admin" ? district_id ?? null : null,
    }
  );

  if (rpcError) {
    console.error("approve_access_request_as_role failed", rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const provision = (result ?? {}) as {
    role?: string;
    teacher_id?: string | null;
    school_id?: string | null;
    district_id?: string | null;
  };

  const admin = createAdminClient();

  // Close the loop: tell the requester they're in, with a one-click branded
  // sign-in link (/welcome/<code>). Email failures never undo the approval.
  let approvalEmailSent = false;
  const { data: requestRow } = await admin
    .from("access_requests")
    .select("email")
    .eq("id", request_id)
    .maybeSingle();
  if (requestRow?.email) {
    let schoolName: string | null = null;
    if (schoolId) {
      const { data: school } = await admin
        .from("schools")
        .select("name")
        .eq("id", schoolId)
        .maybeSingle();
      schoolName = school?.name ?? null;
    }
    const signInUrl = await createWelcomeLink(admin, requestRow.email, origin);
    const sent = await sendApprovalEmail({
      to: requestRow.email,
      origin,
      role,
      schoolName,
      signInUrl,
    });
    approvalEmailSent = sent.sent;
    if (!sent.sent) console.error("approval email not sent:", sent.error);
  }

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "access_request.approve",
    target_table: "access_requests",
    target_id: request_id,
    after: {
      role,
      teacher_id: provision.teacher_id ?? null,
      school_id: schoolId ?? null,
      district_id: role === "district_admin" ? district_id ?? null : null,
      created_new_school: Boolean(new_school),
      approval_email_sent: approvalEmailSent,
    },
  });

  return NextResponse.json({
    ok: true,
    role,
    teacher_id: provision.teacher_id ?? null,
    school_id: schoolId ?? null,
    district_id: role === "district_admin" ? district_id ?? null : null,
    approval_email_sent: approvalEmailSent,
  });
}

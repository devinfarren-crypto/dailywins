import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";
import { createWelcomeLink } from "@/src/lib/welcome-link";
import { sendSigninLink } from "@/src/lib/send-signin-link";

const Body = z.object({ email: z.string().trim().email("Enter a valid email") });

// "They lost the email" rescue: mint a fresh one-click /welcome link and send
// it. Founders can resend for any provisioned user (teacher row, any role, or
// an approved access request — covers directors and admins). Site admins can
// resend only for teachers at their own school(s). Every resend is audited.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const email = parsed.data.email.toLowerCase();

  const admin = createAdminClient();
  const { data: callerRoles } = await admin
    .from("role_assignments")
    .select("role, school_id")
    .eq("user_id", user.id);
  const isFounder = (callerRoles ?? []).some((r) => r.role === "founder");
  const siteSchoolIds = (callerRoles ?? [])
    .filter((r) => r.role === "site_admin" && r.school_id)
    .map((r) => r.school_id as string);

  if (!isFounder && siteSchoolIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // The target must already be provisioned somewhere — this is a re-send, not
  // an invite (the Teachers page handles new invites).
  const { data: targetTeacher } = await admin
    .from("teachers")
    .select("auth_id, school_id, deactivated_at")
    .eq("email", email)
    .maybeSingle();

  if (targetTeacher?.deactivated_at) {
    return NextResponse.json({ error: "That account is deactivated — reactivate it first." }, { status: 400 });
  }

  let allowed = false;
  if (isFounder) {
    if (targetTeacher) {
      allowed = true;
    } else {
      const { data: targetUser } = await admin
        .schema("auth")
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (targetUser?.id) {
        const [{ data: roleRow }, { data: requestRow }] = await Promise.all([
          admin.from("role_assignments").select("id").eq("user_id", targetUser.id).limit(1).maybeSingle(),
          admin.from("access_requests").select("status").eq("user_id", targetUser.id).maybeSingle(),
        ]);
        allowed = Boolean(roleRow) || requestRow?.status === "approved";
      }
    }
  } else {
    // Site admin: only teachers at their school(s).
    allowed = Boolean(targetTeacher && siteSchoolIds.includes(targetTeacher.school_id));
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "No provisioned account found for that email (use Invite for new teachers)." },
      { status: 404 }
    );
  }

  const signInUrl = await createWelcomeLink(admin, email, origin);
  const result = await sendSigninLink({ to: email, origin, signInUrl });

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "signin_link.resend",
    target_table: "auth.users",
    after: { email, email_sent: result.sent },
  });

  if (!result.sent) {
    return NextResponse.json({
      ok: true,
      email_sent: false,
      warning: result.error ?? "Link created but the email could not be sent.",
    });
  }
  return NextResponse.json({ ok: true, email_sent: true });
}

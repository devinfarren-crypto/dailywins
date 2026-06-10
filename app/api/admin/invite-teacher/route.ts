import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { writeAuditLog } from "@/src/lib/audit-log";
import { sendTeacherInvite } from "@/src/lib/send-teacher-invite";

const Body = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  school_id: z.string().uuid().optional(),
});

// Site Admin (or Founder) invites a teacher by EMAIL. Creates an email-bound
// invite (claimed automatically when that email signs in) and emails the teacher
// a link — no copy/paste, no out-of-band sending.
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const email = parsed.data.email.toLowerCase();

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

  // Resolve the school, scoped to what the caller administers.
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

  // Create the email-bound invite as the caller (RPC re-checks authority).
  const { error: inviteError } = await supabase.rpc("create_teacher_invite", {
    p_school_id: schoolId,
    p_email: email,
  });
  if (inviteError) {
    console.error("create_teacher_invite failed", inviteError);
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  // Look up the school name + inviter name for the email body.
  const { data: school } = await admin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  const { data: inviter } = await admin
    .from("teachers")
    .select("full_name")
    .eq("auth_id", user.id)
    .maybeSingle();

  // Mint a one-click sign-in link so the whole invite is a SINGLE email.
  // generateLink does NOT send Supabase's own email — we embed the link in
  // ours. 'invite' creates the auth user for a brand-new email; existing
  // accounts get a 'magiclink' instead. The token is stored server-side and
  // the email carries a SHORT branded link (/welcome/<code>) instead of the
  // raw token URL — prettier, and the /welcome interstitial keeps mail
  // scanners from burning the one-time token. If minting fails we fall back
  // to the prefilled landing-page link (two-step, but still works).
  let signInUrl: string | null = null;
  try {
    let linkRes = await admin.auth.admin.generateLink({ type: "invite", email });
    if (linkRes.error) {
      linkRes = await admin.auth.admin.generateLink({ type: "magiclink", email });
    }
    const props = linkRes.data?.properties;
    if (!linkRes.error && props?.hashed_token) {
      const otpType = props.verification_type ?? "magiclink";
      const code = randomBytes(9).toString("base64url");
      const { error: linkRowError } = await admin.from("invite_signin_links").insert({
        code,
        token_hash: props.hashed_token,
        otp_type: otpType,
        email,
      });
      if (!linkRowError) {
        signInUrl = `${origin}/welcome/${code}`;
      } else {
        console.error("invite_signin_links insert failed", linkRowError.message);
      }
    } else if (linkRes.error) {
      console.error("generateLink failed", linkRes.error.message);
    }
  } catch (err) {
    console.error("generateLink threw", err);
  }

  const result = await sendTeacherInvite({
    to: email,
    origin,
    schoolName: school?.name ?? "your school",
    inviterName: inviter?.full_name ?? undefined,
    signInUrl,
  });

  await writeAuditLog(admin, {
    actor_user_id: user.id,
    action: "invite.create",
    target_table: "invites",
    target_id: schoolId,
    after: { role: "teacher", school_id: schoolId, email, email_sent: result.sent },
  });

  if (!result.sent) {
    // The invite exists; the email just didn't go out. Tell the admin so they
    // can fall back to "go to dailywins.school and sign in with your email".
    return NextResponse.json({
      ok: true,
      email,
      email_sent: false,
      warning: result.error ?? "Invite created but the email could not be sent.",
    });
  }

  return NextResponse.json({ ok: true, email, email_sent: true });
}

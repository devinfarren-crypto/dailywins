import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { notifyNewAccessRequest } from "@/src/lib/notify-new-access-request";

// Shared post-authentication provisioning. Given a freshly authenticated user
// (from OAuth code exchange in /auth/callback, or email token_hash verification
// in /auth/confirm), resolve their access state and return the path to redirect
// to. Keeping this in one place guarantees both auth entry points enforce the
// same approval gate, invite redemption, and founder notification.
export async function resolvePostAuthRedirect(
  user: User,
  origin: string,
  inviteToken = ""
): Promise<string> {
  if (!user.email) {
    return "/access-denied";
  }

  const admin = createAdminClient();
  const email = user.email.toLowerCase();

  const { data: existingTeacher } = await admin
    .from("teachers")
    .select("id, deactivated_at, preferences")
    .eq("auth_id", user.id)
    .maybeSingle();

  // A deactivated teacher keeps their data but loses access (deactivate, don't
  // delete). Block at the login gate; a site_admin/founder can reactivate them.
  if (existingTeacher?.deactivated_at) {
    return "/access-denied";
  }

  // A teacher row means the teacher dashboard is their home — unless the row
  // was minted by the "What teachers see" demo (preferences.admin_first):
  // directors keep landing on their admin home and reach the demo dashboard
  // from there. Real teacher rows never carry the flag.
  const adminFirst =
    (existingTeacher?.preferences as { admin_first?: boolean } | null)?.admin_first === true;
  if (existingTeacher && !adminFirst) {
    return "/dashboard";
  }

  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["teacher", "site_admin", "district_admin", "founder"]);
  const roles = (roleRows ?? []).map((r) => r.role);

  // Holds a 'teacher' role but no teachers row yet → the dashboard's
  // ensure_teacher_exists path finishes provisioning.
  if (roles.includes("teacher")) {
    return "/dashboard";
  }

  // Pure admins (no teacher row) land on their role's home surface — the teacher
  // dashboard would bounce them to /pending via ensure_teacher_exists.
  //   founder        → the management/act-as hub (/admin/teachers)
  //   site_admin     → the admin home (checklist + onboarding; NPS directors
  //                    hold this role, so a new director never lands on an
  //                    empty stats page)
  //   district_admin → NPS-shaped orgs go to the admin home too; true
  //                    district admins keep the PII-blind usage dashboard
  if (roles.includes("founder")) {
    return "/admin/teachers";
  }
  if (roles.includes("site_admin")) {
    return "/admin/home";
  }
  if (roles.includes("district_admin")) {
    const { data: districtRoles } = await admin
      .from("role_assignments")
      .select("district_id, districts(org_type)")
      .eq("user_id", user.id)
      .eq("role", "district_admin")
      .not("district_id", "is", null);
    const allNps =
      (districtRoles ?? []).length > 0 &&
      (districtRoles ?? []).every(
        (r) => (r.districts as { org_type?: string } | null)?.org_type === "nps"
      );
    return allNps ? "/admin/home" : "/admin/usage";
  }

  // Email-bound teacher invite: a site admin pre-authorized this email address.
  // Supabase has verified the user controls it, so matching it provisions them as
  // a teacher — no URL token, works on any device / sign-in method. Takes
  // precedence over any stale pending access request for the same user.
  const { data: claim } = await admin.rpc("claim_email_teacher_invite", {
    p_user_id: user.id,
  });
  if (claim?.claimed) {
    return "/dashboard";
  }

  if (inviteToken) {
    try {
      const { error: inviteError } = await admin.rpc("redeem_invite", {
        p_raw_token: inviteToken,
      });

      if (!inviteError) {
        return "/dashboard";
      }

      console.error("Invite redemption failed:", inviteError.message);
    } catch (inviteFailure) {
      console.error("Invite redemption threw:", inviteFailure);
    }
  }

  const { data: requestRow } = await admin
    .from("access_requests")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (requestRow) {
    if (requestRow.status === "approved") {
      return "/dashboard";
    }

    if (requestRow.status === "pending") {
      return "/pending";
    }

    return "/access-denied";
  }

  const fullName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Teacher";

  const { data: newRequest, error: upsertError } = await admin
    .from("access_requests")
    .upsert(
      {
        user_id: user.id,
        email,
        full_name: fullName,
        status: "pending",
      },
      { onConflict: "user_id" }
    )
    .select("id")
    .single();

  if (upsertError) {
    console.error("Failed to auto-create access request:", upsertError.message);
  } else if (newRequest) {
    await notifyNewAccessRequest({
      email,
      fullName,
      requestId: newRequest.id,
      origin,
    });
  }

  return "/pending";
}

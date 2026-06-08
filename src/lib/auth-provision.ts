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
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  // A teacher row means the teacher dashboard is their home.
  if (existingTeacher) {
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
  // dashboard would bounce them to /pending via ensure_teacher_exists. Each tier
  // has a distinct home (per docs/TIERED_ARCHITECTURE_v1.1):
  //   founder        → the management/act-as hub (/admin/teachers)
  //   district_admin → the PII-blind district usage dashboard (/admin/usage)
  //   site_admin     → bell-schedule management (/admin/upload-schedule)
  if (roles.includes("founder")) {
    return "/admin/teachers";
  }
  if (roles.includes("district_admin")) {
    return "/admin/usage";
  }
  if (roles.includes("site_admin")) {
    return "/admin/upload-schedule";
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

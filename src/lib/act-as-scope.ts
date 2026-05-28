import type { SupabaseClient } from "@supabase/supabase-js";

// Authority check for act-as. Returns true if `actorAuthId` can act-as
// `targetAuthId` under the v1 rules (see docs/ACT_AS_DESIGN_v1.md):
//
//   - Founder (regular) → any Teacher.
//   - District Admin → any Teacher in their district.
//   - Site Admin → any Teacher at their school.
//   - Teacher → nobody.
//   - Founder break-glass is a separate path (canBreakGlass), not this fn.
//
// Uses the service-role admin client so the check is consistent regardless
// of the caller's session RLS posture.

export type ActAsTier = "founder" | "district_admin" | "site_admin";

interface RoleAssignmentRow {
  role: string;
  school_id: string | null;
  district_id: string | null;
}

export async function canActAs(
  admin: SupabaseClient,
  actorAuthId: string,
  targetAuthId: string
): Promise<{ allowed: boolean; reason?: string; tier?: ActAsTier }> {
  if (actorAuthId === targetAuthId) {
    return { allowed: false, reason: "Cannot act-as yourself" };
  }

  // Actor's role assignments (highest tier wins).
  const { data: actorRoles, error: actorErr } = await admin
    .from("role_assignments")
    .select("role, school_id, district_id")
    .eq("user_id", actorAuthId);

  if (actorErr) {
    console.error("canActAs: failed to load actor roles", actorErr);
    return { allowed: false, reason: "Unable to verify actor role" };
  }

  const roles = (actorRoles ?? []) as RoleAssignmentRow[];
  const isFounder = roles.some((r) => r.role === "founder");
  const districtAdminAssignments = roles.filter((r) => r.role === "district_admin");
  const siteAdminAssignments = roles.filter((r) => r.role === "site_admin");

  // Target must be a Teacher for the regular act-as path. Find their
  // teacher row to confirm role + scope.
  const { data: targetTeacher, error: teacherErr } = await admin
    .from("teachers")
    .select("id, school_id")
    .eq("auth_id", targetAuthId)
    .maybeSingle();

  if (teacherErr) {
    console.error("canActAs: failed to load target teacher row", teacherErr);
    return { allowed: false, reason: "Unable to verify target" };
  }

  if (!targetTeacher) {
    return { allowed: false, reason: "Target is not a Teacher (use break-glass)" };
  }

  if (isFounder) {
    return { allowed: true, tier: "founder" };
  }

  // District Admin: target's school must be in actor's district.
  if (districtAdminAssignments.length > 0) {
    const { data: targetSchool } = await admin
      .from("schools")
      .select("district_id")
      .eq("id", targetTeacher.school_id)
      .maybeSingle();

    if (
      targetSchool?.district_id &&
      districtAdminAssignments.some(
        (a) => a.district_id === targetSchool.district_id
      )
    ) {
      return { allowed: true, tier: "district_admin" };
    }
  }

  // Site Admin: target's school must match actor's.
  if (siteAdminAssignments.length > 0) {
    if (
      siteAdminAssignments.some((a) => a.school_id === targetTeacher.school_id)
    ) {
      return { allowed: true, tier: "site_admin" };
    }
  }

  return { allowed: false, reason: "Target is outside your scope" };
}

export async function canBreakGlass(
  admin: SupabaseClient,
  actorAuthId: string,
  targetAuthId: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (actorAuthId === targetAuthId) {
    return { allowed: false, reason: "Cannot break-glass to yourself" };
  }

  const { data, error } = await admin
    .from("role_assignments")
    .select("role")
    .eq("user_id", actorAuthId)
    .eq("role", "founder")
    .maybeSingle();

  if (error) {
    console.error("canBreakGlass: failed to verify founder role", error);
    return { allowed: false, reason: "Unable to verify role" };
  }
  if (!data) {
    return { allowed: false, reason: "Break-glass is founder-only" };
  }
  return { allowed: true };
}

import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

// Lists teachers the caller can act-as. Founder sees all; site_admin sees
// teachers at their school; district_admin sees teachers in their district.
// Teachers and unauthenticated callers get 403/401 respectively.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: roles, error: rolesError } = await admin
    .from("role_assignments")
    .select("role, school_id, district_id")
    .eq("user_id", user.id);

  if (rolesError) {
    console.error("Failed to load actor roles", rolesError);
    return NextResponse.json({ error: "Unable to verify role" }, { status: 500 });
  }

  const isFounder = roles?.some((r) => r.role === "founder") ?? false;
  const districtIds = (roles ?? [])
    .filter((r) => r.role === "district_admin" && r.district_id)
    .map((r) => r.district_id as string);
  const schoolIds = (roles ?? [])
    .filter((r) => r.role === "site_admin" && r.school_id)
    .map((r) => r.school_id as string);

  if (!isFounder && districtIds.length === 0 && schoolIds.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = admin
    .from("teachers")
    .select("id, auth_id, full_name, email, school_id, schools(name, district_id, district)")
    .order("full_name", { ascending: true });

  if (!isFounder) {
    // Build the union of in-scope school_ids: schools in districtIds + schoolIds.
    let inScopeSchoolIds = [...schoolIds];
    if (districtIds.length > 0) {
      const { data: districtSchools } = await admin
        .from("schools")
        .select("id")
        .in("district_id", districtIds);
      if (districtSchools) {
        inScopeSchoolIds = [
          ...inScopeSchoolIds,
          ...districtSchools.map((s) => s.id),
        ];
      }
    }
    if (inScopeSchoolIds.length === 0) {
      return NextResponse.json({ teachers: [] });
    }
    query = query.in("school_id", inScopeSchoolIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to list teachers", error);
    return NextResponse.json({ error: "Unable to load teachers" }, { status: 500 });
  }

  // Hide the caller from their own list (you can't act-as yourself).
  const visible = (data ?? []).filter((t) => t.auth_id !== user.id);

  return NextResponse.json({
    teachers: visible.map((t) => ({
      id: t.id,
      auth_id: t.auth_id,
      full_name: t.full_name,
      email: t.email,
      school_id: t.school_id,
      // schools join returns an object or null
      school_name:
        (t.schools as { name?: string } | null)?.name ?? null,
      district:
        (t.schools as { district?: string } | null)?.district ?? null,
    })),
  });
}

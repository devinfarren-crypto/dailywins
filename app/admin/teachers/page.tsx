import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import TeachersClient, { type TeacherRow } from "./TeachersClient";

export const metadata: Metadata = {
  title: "Teachers — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AdminTeachersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Gate: caller must be founder, district_admin, or site_admin.
  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("role_assignments")
    .select("role, school_id, district_id")
    .eq("user_id", user.id);

  const isFounder = roles?.some((r) => r.role === "founder") ?? false;
  const isSiteAdmin = roles?.some((r) => r.role === "site_admin") ?? false;
  const isDistrictAdmin = roles?.some((r) => r.role === "district_admin") ?? false;

  // Per docs/TIERED_ARCHITECTURE_v1.1, a District Admin "cannot view any
  // teacher's roster" — they get aggregate stats only. So this roster page is
  // founder + site_admin; a pure district admin is sent to their usage home.
  if (!isFounder && !isSiteAdmin) {
    if (isDistrictAdmin) redirect("/admin/usage");
    redirect("/dashboard");
  }

  // Load the in-scope teacher list server-side so the page renders complete.
  // (The /api/admin/teachers route uses the same logic and is what the client
  // would re-call after refresh.) Founders see all; site admins see their
  // school(s). District scope is intentionally excluded here (see above).
  let teachers: TeacherRow[] = [];

  let inScopeSchoolIds: string[] = [];
  if (!isFounder) {
    inScopeSchoolIds = (roles ?? [])
      .filter((r) => r.role === "site_admin" && r.school_id)
      .map((r) => r.school_id as string);
  }

  let query = admin
    .from("teachers")
    .select("id, auth_id, full_name, email, school_id, deactivated_at, schools(name, district)")
    .order("full_name", { ascending: true });

  if (!isFounder) {
    if (inScopeSchoolIds.length === 0) {
      teachers = [];
    } else {
      query = query.in("school_id", inScopeSchoolIds);
    }
  }

  if (isFounder || inScopeSchoolIds.length > 0) {
    const { data } = await query;
    teachers = (data ?? [])
      .filter((t) => t.auth_id !== user.id)
      .map((t) => ({
        id: t.id,
        auth_id: t.auth_id,
        full_name: t.full_name,
        email: t.email,
        school_name:
          (t.schools as { name?: string } | null)?.name ?? null,
        district:
          (t.schools as { district?: string } | null)?.district ?? null,
        deactivated: Boolean(t.deactivated_at),
      }));
  }

  return (
    <TeachersClient
      teachers={teachers}
      isFounder={isFounder}
      isSiteAdmin={isSiteAdmin}
      showSiteAdminNav={isSiteAdmin && !isFounder}
    />
  );
}

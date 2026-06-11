import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import SignOutButton from "@/src/components/SignOutButton";
import LaunchClient from "./LaunchClient";

export const metadata: Metadata = { title: "Home — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

// The admin home — a one-step-at-a-time launch sequence (LaunchClient) rather
// than a wall of setup text. The server side just resolves who/where and the
// live completion state; the experience lives in the client component.
export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, school_id, district_id")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const siteSchoolId = (roleRows ?? []).find((r) => r.role === "site_admin" && r.school_id)?.school_id ?? null;
  const districtIds = (roleRows ?? [])
    .filter((r) => r.role === "district_admin" && r.district_id)
    .map((r) => r.district_id as string);

  if (!siteSchoolId && districtIds.length === 0) {
    if (roles.includes("founder")) redirect("/admin/teachers");
    redirect("/auth/home");
  }

  let schoolId = siteSchoolId as string | null;
  if (!schoolId && districtIds.length > 0) {
    const { data: school } = await admin
      .from("schools")
      .select("id")
      .in("district_id", districtIds)
      .limit(1)
      .maybeSingle();
    schoolId = school?.id ?? null;
  }
  if (!schoolId) redirect("/auth/home");

  const { data: schoolRow } = await admin
    .from("schools")
    .select("name, schedules, link_settings, launch_finished_at, districts(org_type)")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName = schoolRow?.name ?? "Your school";
  const isNps = (schoolRow?.districts as { org_type?: string } | null)?.org_type === "nps";
  const scheduleVariants = schoolRow?.schedules
    ? Object.keys(schoolRow.schedules as Record<string, unknown>).length
    : 0;
  const hasSchedule = scheduleVariants > 0;
  const linkSettings = (schoolRow?.link_settings ?? {}) as Record<string, boolean>;
  const linksOn = ["parent", "student", "co_teacher"].filter((k) => linkSettings[k] !== false).length;
  const parentLinksOn = linkSettings.parent !== false;

  // Counts reflect the REAL school: the director's demo-minted teacher row
  // (admin_first), [DEMO] students, and archived students are excluded.
  const [{ count: teacherCount }, { count: studentCount }] = await Promise.all([
    admin
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .is("deactivated_at", null)
      .or("preferences->>admin_first.is.null,preferences->>admin_first.neq.true"),
    admin
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .is("archived_at", null)
      .not("display_name", "like", "[DEMO] %"),
  ]);

  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>
              {isNps ? "· Director home ·" : "· Site admin home ·"}
            </div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>
              {schoolName}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>
              {isNps ? "You run this — every tab below is yours." : "Your school-administration hub."}
            </p>
          </div>
          <SignOutButton />
        </header>

        <SiteAdminNav current="home" />

        {/* No extra top margin — the navy band should sit the same distance
            under the tabs here as on every other admin tab. */}
        <div>
          <LaunchClient
            schoolId={schoolId}
            schoolName={schoolName}
            isNps={isNps}
            userEmail={user.email ?? "your email"}
            serverFinished={Boolean(schoolRow?.launch_finished_at)}
            initial={{
              teacherCount: teacherCount ?? 0,
              studentCount: studentCount ?? 0,
              hasSchedule,
              scheduleVariants,
              linksOn,
              parentLinksOn,
            }}
          />
        </div>
      </div>
    </main>
  );
}

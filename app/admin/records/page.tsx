import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import AdminNavyBand from "@/src/components/AdminNavyBand";
import SignOutButton from "@/src/components/SignOutButton";
import RecordsClient from "./RecordsClient";

export const metadata: Metadata = { title: "Student records — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

// NPS director records view. Only meaningful at an org_type='nps' school —
// district-shaped site admins stay PII-blind (035) and see an explanation
// instead. Founders are excluded on purpose: operator blindness holds.
export default async function RecordsPage() {
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
    if (roles.includes("founder")) {
      // Operator blindness: founders don't get a records view. Test via an
      // NPS director account or an audited act-as session.
      return (
        <Shell title="Student records" subtitle="Not available on the founder account." showNav={false}>
          <Card>
            Student records are visible only to the school&apos;s own director (NPS
            organizations) — the operator account is PII-blind by design. Use an
            NPS director test account, or an audited act-as session.
          </Card>
        </Shell>
      );
    }
    redirect("/auth/home");
  }

  // Resolve the school: site admins are pinned; an NPS director may instead
  // (or also) hold district_admin over the single-school org.
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
  if (!schoolId) {
    return (
      <Shell title="Student records" subtitle="No school found for your account." showNav={false}>
        <Card>Your organization has no school yet.</Card>
      </Shell>
    );
  }

  const { data: schoolRow } = await admin
    .from("schools")
    .select("name, district_id, districts(org_type)")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName = schoolRow?.name ?? "Your school";
  const orgType = (schoolRow?.districts as { org_type?: string } | null)?.org_type ?? "district";

  if (orgType !== "nps") {
    return (
      <Shell title={schoolName} subtitle="Records view is for NPS organizations." showNav={true}>
        <Card>
          At district-managed schools, individual student records stay with the
          teacher — administrators see aggregate usage only, by database design.
          (Districts access notes through the audited notes archive.)
        </Card>
      </Shell>
    );
  }

  return (
    <Shell
      title={schoolName}
      subtitle="Full student records — every goal, every note, across your school"
      showNav={true}
    >
      <RecordsClient schoolId={schoolId} schoolName={schoolName} />
      <p style={{ marginTop: 28, fontSize: 12, color: "var(--ssd-text-muted)", lineHeight: 1.5, maxWidth: 720 }}>
        As the school&apos;s director you can see every score and every note —
        shared and private — recorded at your school. Each record you open is
        noted in the audit log, so your school&apos;s access trail is always
        complete.
      </p>
    </Shell>
  );
}

function Shell({
  title,
  subtitle,
  showNav,
  children,
}: {
  title: string;
  subtitle: string;
  showNav: boolean;
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>· Student records ·</div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>{title}</h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>{subtitle}</p>
          </div>
          <SignOutButton />
        </header>
        {showNav ? (
          <>
            <SiteAdminNav current="records" />
            <AdminNavyBand
              title="Every score and note, on demand."
              sub="Complete records for placement calls — every open is logged."
            />
          </>
        ) : null}
        {children}
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--ssd-surface)",
        border: "1px solid var(--ssd-border)",
        borderRadius: "var(--ssd-radius)",
        padding: "22px 24px",
        maxWidth: 640,
        fontSize: 14.5,
        lineHeight: 1.55,
        color: "var(--ssd-text)",
      }}
    >
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import {
  listAllAuditRows,
  listScopedAuditRows,
  type EnrichedAuditRow,
} from "@/src/lib/audit-log-query";
import AuditRowList from "@/src/components/AuditRowList";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import AdminNavyBand from "@/src/components/AdminNavyBand";
import SignOutButton from "@/src/components/SignOutButton";

export const metadata: Metadata = {
  title: "Audit log — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, school_id, district_id")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isFounder = roles.includes("founder");

  let rows: EnrichedAuditRow[];
  let subtitle: string;
  let showSiteNav = false;
  let scopedNote: string | null = null;

  if (isFounder) {
    rows = await listAllAuditRows(admin, 200);
    subtitle =
      "All administrative actions across the platform. Newest first; up to the last 200 events.";
  } else {
    // Scoped read: district admins see their district, site admins their
    // school. Domain = the auth users tied to those schools (teachers + role
    // holders); rows match when the actor or acted-as user is in the domain.
    const districtIds = (roleRows ?? [])
      .filter((r) => r.role === "district_admin" && r.district_id)
      .map((r) => r.district_id as string);
    const schoolIds = new Set(
      (roleRows ?? [])
        .filter((r) => r.role === "site_admin" && r.school_id)
        .map((r) => r.school_id as string)
    );
    if (districtIds.length > 0) {
      const { data: schools } = await admin
        .from("schools")
        .select("id")
        .in("district_id", districtIds);
      for (const s of schools ?? []) schoolIds.add(s.id);
    }
    if (schoolIds.size === 0) redirect("/auth/home");

    const ids = Array.from(schoolIds);
    const userIds = new Set<string>([user.id]);
    const { data: teachers } = await admin
      .from("teachers")
      .select("auth_id")
      .in("school_id", ids);
    for (const t of teachers ?? []) if (t.auth_id) userIds.add(t.auth_id);

    let raQuery = admin.from("role_assignments").select("user_id");
    if (districtIds.length > 0) {
      raQuery = raQuery.or(
        `school_id.in.(${ids.join(",")}),district_id.in.(${districtIds.join(",")})`
      );
    } else {
      raQuery = raQuery.in("school_id", ids);
    }
    const { data: roleHolders } = await raQuery;
    for (const r of roleHolders ?? []) if (r.user_id) userIds.add(r.user_id);

    rows = await listScopedAuditRows(admin, Array.from(userIds), 200);
    subtitle =
      districtIds.length > 0
        ? "Administrative actions across your district's schools. Newest first; up to the last 200 events."
        : "Administrative actions at your school. Newest first; up to the last 200 events.";
    // NPS directors hold site_admin AND district_admin — they still get the
    // school nav (hiding it left them with nothing but Sign out).
    showSiteNav = roles.includes("site_admin");

    // The footer must tell the truth for the org shape: an NPS director DOES
    // see student-record access entries (their own trail — nps_record.*);
    // district-shaped admins are PII-blind and see none. One blanket "never
    // shown by database design" line contradicted the Student records tab.
    let isNpsDirector = false;
    if (districtIds.length > 0 && roles.includes("site_admin")) {
      const { data: orgs } = await admin
        .from("districts")
        .select("org_type")
        .in("id", districtIds);
      isNpsDirector = (orgs ?? []).some((o) => o.org_type === "nps");
    }
    scopedNote = isNpsDirector
      ? "This view covers administrative actions and your school's record-access trail — every student record opened under Student records appears here as an nps_record entry. The contents of scores and notes never appear in this log, only the fact of access."
      : "This view covers administrative and configuration actions in your domain. Entries that touch individual student records are never shown to administrators — by database design.";
  }

  return (
    <main className="min-h-screen bg-[var(--ssd-paper)] px-5 py-10">
      <section className="mx-auto w-full max-w-[1000px]">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>· Audit log ·</div>
            <h1
              style={{
                fontFamily: "var(--ssd-font-display), Georgia, serif",
                fontSize: 32,
                fontWeight: 500,
                color: "var(--ssd-ink)",
                margin: "0 0 4px",
              }}
            >
              Audit log
            </h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>{subtitle}</p>
          </div>
          {!isFounder ? <SignOutButton /> : null}
        </header>

        {showSiteNav ? (
          <>
            <SiteAdminNav current="audit" />
            <AdminNavyBand
              title="Your access trail, airtight."
              sub="Who did what, when — including you."
            />
          </>
        ) : !isFounder ? (
          <p style={{ marginBottom: 16 }}>
            <a href="/admin/usage" style={{ fontSize: 13, fontWeight: 600, color: "var(--ssd-green)", textDecoration: "none" }}>
              ← Back to usage
            </a>
          </p>
        ) : null}

        <AuditRowList rows={rows} />

        {scopedNote ? (
          <p className="mt-7 text-xs leading-relaxed text-[var(--ssd-text-muted)]">{scopedNote}</p>
        ) : null}
      </section>
    </main>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import AdminNavyBand from "@/src/components/AdminNavyBand";
import SignOutButton from "@/src/components/SignOutButton";
import LinksClient, { type SchoolLinkRow } from "./LinksClient";
import LinkPolicyCard from "./LinkPolicyCard";

export const metadata: Metadata = { title: "Family links — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

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
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>· Family &amp; team links ·</div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>{title}</h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>{subtitle}</p>
          </div>
          <SignOutButton />
        </header>
        {showNav ? (
          <>
            <SiteAdminNav current="links" />
            <AdminNavyBand
              title="You decide which links exist."
              sub="Turn parent, student, and co-teacher links on or off — revoke any single link instantly."
            />
          </>
        ) : null}
        {children}
        <p style={{ marginTop: 28, fontSize: 12, color: "var(--ssd-text-muted)", lineHeight: 1.5 }}>
          Links are listed by the teacher who created them — student names are never shown to
          administrators, by database design. Revoking takes effect immediately, is permanent for
          that link (the teacher can always generate a new one), and is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}

export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, school_id")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isFounder = roles.includes("founder");
  const siteAdminSchoolId = (roleRows ?? []).find((r) => r.role === "site_admin")?.school_id ?? null;

  if (!isFounder && !siteAdminSchoolId) redirect("/auth/home");

  // Founders pick a school (?school=); site admins are pinned to theirs.
  const { school: schoolParam } = await searchParams;
  let schoolId = siteAdminSchoolId as string | null;
  let schoolPicker: { id: string; name: string }[] = [];
  if (isFounder) {
    const { data: schools } = await admin.from("schools").select("id, name").order("name");
    schoolPicker = schools ?? [];
    schoolId = schoolParam ?? siteAdminSchoolId ?? schoolPicker[0]?.id ?? null;
  }

  if (!schoolId) {
    return (
      <Shell title="Family links" subtitle="No school to show links for yet." showNav={!isFounder}>
        <div style={{ fontSize: 14, color: "var(--ssd-text-muted)" }}>Add a school first.</div>
      </Shell>
    );
  }

  const { data: schoolRow } = await admin.from("schools").select("name").eq("id", schoolId).single();
  const schoolName = schoolRow?.name ?? "Your school";

  // Session client, not admin — the RPC re-checks the caller's role itself.
  const { data, error } = await supabase.rpc("list_school_magic_links", { p_school_id: schoolId });
  if (error) {
    return (
      <Shell title={schoolName} subtitle="Couldn't load this school's links right now." showNav={!isFounder}>
        <div style={{ fontSize: 14, color: "var(--ssd-text-muted)" }}>{error.message}</div>
      </Shell>
    );
  }
  const rows = (data ?? []) as SchoolLinkRow[];
  const active = rows.filter((r) => !r.revoked_at && new Date(r.expires_at) >= new Date()).length;

  return (
    <Shell
      title={schoolName}
      subtitle={`${active} active link${active === 1 ? "" : "s"} · parent, student, and co-teacher access at your school`}
      showNav={!isFounder}
    >
      {isFounder && schoolPicker.length > 1 ? (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {schoolPicker.map((s) => (
            <a
              key={s.id}
              href={`/admin/links?school=${s.id}`}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                textDecoration: "none",
                border: "1px solid var(--ssd-border)",
                background: s.id === schoolId ? "var(--ssd-green)" : "var(--ssd-surface)",
                color: s.id === schoolId ? "#fff" : "var(--ssd-text-muted)",
              }}
            >
              {s.name}
            </a>
          ))}
        </div>
      ) : null}
      <LinkPolicyCard schoolId={schoolId} />
      <LinksClient rows={rows} />
    </Shell>
  );
}

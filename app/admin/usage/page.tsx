import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

export const metadata: Metadata = { title: "Usage — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

interface DistrictSchool {
  school_id: string;
  name: string;
  district: string;
  teachers: number;
  students: number;
  active_teachers_7d: number;
  active_teachers_30d: number;
  scores_7d: number;
  last_activity: string | null;
  has_schedule: boolean;
}
interface SiteTeacher {
  teacher_id: string;
  name: string;
  school: string;
  scores_7d: number;
  scores_30d: number;
  last_activity: string | null;
}
type Totals = Record<string, number>;

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>{children}</div>;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div
      style={{
        background: "var(--ssd-surface)",
        border: "1px solid var(--ssd-border)",
        borderTop: "3px solid var(--ssd-green)",
        borderRadius: "var(--ssd-radius)",
        padding: "16px 18px",
        minWidth: 150,
        flex: "1 1 150px",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 600, color: "var(--ssd-ink)", fontFamily: DISPLAY }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", marginTop: 2 }}>{label}</div>
      {hint ? <div style={{ fontSize: 11, color: "var(--ssd-text-muted)", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--ssd-font-mono), monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ssd-text-muted)",
  padding: "8px 12px",
  borderBottom: "1px solid var(--ssd-border)",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--ssd-text)",
  borderBottom: "1px solid var(--ssd-border)",
};

function Shell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>{title}</h1>
          <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>{subtitle}</p>
        </header>
        {children}
        <p style={{ marginTop: 28, fontSize: 12, color: "var(--ssd-text-muted)", lineHeight: 1.5 }}>
          These figures are aggregate usage only. Individual student behavior scores and notes are never visible to
          administrators — by database design.
        </p>
      </div>
    </main>
  );
}

export default async function UsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isDistrictAdmin = roles.includes("district_admin");
  const isSiteAdmin = roles.includes("site_admin");

  // District view takes precedence (district rollups). Site admins see their
  // per-teacher activity. Anyone else doesn't belong here.
  if (isDistrictAdmin) {
    const { data, error } = await supabase.rpc("get_district_usage");
    if (error || !data) {
      return (
        <Shell eyebrow="· District usage ·" title="Usage" subtitle="Couldn't load district usage right now.">
          <div style={{ color: "var(--ssd-text-muted)", fontSize: 14 }}>{error?.message ?? "No data."}</div>
        </Shell>
      );
    }
    const totals = (data.totals ?? {}) as Totals;
    const schools = (data.schools ?? []) as DistrictSchool[];
    const districtName = schools[0]?.district ?? "Your district";
    return (
      <Shell eyebrow="· District usage ·" title={districtName} subtitle="Aggregate adoption across your schools">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
          <StatCard label="Schools" value={totals.schools ?? 0} />
          <StatCard label="Teachers" value={totals.teachers ?? 0} />
          <StatCard label="Students tracked" value={totals.students ?? 0} />
          <StatCard label="Active teachers" value={totals.active_teachers_7d ?? 0} hint="logged in last 7 days" />
          <StatCard label="Entries logged" value={totals.scores_7d ?? 0} hint="last 7 days" />
          <StatCard label="Schedules set" value={`${totals.schools_with_schedule ?? 0}/${totals.schools ?? 0}`} hint="bell schedules uploaded" />
        </div>

        <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>School</th>
                <th style={th}>Teachers</th>
                <th style={th}>Students</th>
                <th style={th}>Active 7d</th>
                <th style={th}>Active 30d</th>
                <th style={th}>Entries 7d</th>
                <th style={th}>Last activity</th>
                <th style={th}>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {schools.length === 0 ? (
                <tr><td style={td} colSpan={8}>No schools in your district yet.</td></tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.school_id}>
                    <td style={{ ...td, fontWeight: 600, color: "var(--ssd-ink)" }}>{s.name}</td>
                    <td style={td}>{s.teachers}</td>
                    <td style={td}>{s.students}</td>
                    <td style={td}>{s.active_teachers_7d}</td>
                    <td style={td}>{s.active_teachers_30d}</td>
                    <td style={td}>{s.scores_7d}</td>
                    <td style={td}>{fmtDate(s.last_activity)}</td>
                    <td style={td}>
                      <span style={{ color: s.has_schedule ? "var(--ssd-green-deep)" : "var(--ssd-status-support)", fontWeight: 600 }}>
                        {s.has_schedule ? "✓ Set" : "— Missing"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Shell>
    );
  }

  if (isSiteAdmin) {
    const { data, error } = await supabase.rpc("get_site_usage");
    if (error || !data) {
      return (
        <Shell eyebrow="· School usage ·" title="Usage" subtitle="Couldn't load school usage right now.">
          <div style={{ color: "var(--ssd-text-muted)", fontSize: 14 }}>{error?.message ?? "No data."}</div>
        </Shell>
      );
    }
    const totals = (data.totals ?? {}) as Totals;
    const teachers = (data.teachers ?? []) as SiteTeacher[];
    const schoolName = teachers[0]?.school ?? "Your school";
    return (
      <Shell eyebrow="· School usage ·" title={schoolName} subtitle="Teacher activity at your school">
        <div style={{ marginBottom: 16 }}>
          <Link href="/admin/upload-schedule" style={{ fontSize: 13, fontWeight: 600, color: "var(--ssd-green-deep)", textDecoration: "none" }}>
            ← Bell schedules
          </Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
          <StatCard label="Teachers" value={totals.teachers ?? 0} />
          <StatCard label="Students tracked" value={totals.students ?? 0} />
          <StatCard label="Active teachers" value={totals.active_teachers_7d ?? 0} hint="logged in last 7 days" />
          <StatCard label="Entries logged" value={totals.scores_7d ?? 0} hint="last 7 days" />
          <StatCard label="Schedules set" value={`${totals.schools_with_schedule ?? 0}/${totals.schools_total ?? 0}`} hint="bell schedules uploaded" />
        </div>

        <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Teacher</th>
                <th style={th}>Entries 7d</th>
                <th style={th}>Entries 30d</th>
                <th style={th}>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr><td style={td} colSpan={4}>No teachers at your school yet.</td></tr>
              ) : (
                teachers.map((t) => (
                  <tr key={t.teacher_id}>
                    <td style={{ ...td, fontWeight: 600, color: "var(--ssd-ink)" }}>{t.name}</td>
                    <td style={td}>{t.scores_7d}</td>
                    <td style={td}>{t.scores_30d}</td>
                    <td style={td}>{fmtDate(t.last_activity)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Shell>
    );
  }

  // Founders have their own hub; teachers have the dashboard.
  if (roles.includes("founder")) redirect("/admin/teachers");
  redirect("/dashboard");
}

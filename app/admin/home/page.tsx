import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import SignOutButton from "@/src/components/SignOutButton";
import CopyBlock from "./CopyBlock";

export const metadata: Metadata = { title: "Home — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

// The admin home — the first thing a school leader sees after sign-in.
// Built for the NPS director ("I just got access… now what?") but useful for
// any site admin: a live getting-started checklist, a plain-English "how it
// works", and copy-paste teacher onboarding instructions. No dead ends.
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
    .select("name, schedules, link_settings, districts(org_type)")
    .eq("id", schoolId)
    .maybeSingle();
  const schoolName = schoolRow?.name ?? "Your school";
  const isNps = (schoolRow?.districts as { org_type?: string } | null)?.org_type === "nps";
  const hasSchedule = Boolean(
    schoolRow?.schedules && Object.keys(schoolRow.schedules as Record<string, unknown>).length > 0
  );
  const linkSettings = (schoolRow?.link_settings ?? {}) as Record<string, boolean>;
  const linksOn = ["parent", "student", "co_teacher"].filter((k) => linkSettings[k] !== false).length;

  const [{ count: teacherCount }, { count: studentCount }] = await Promise.all([
    admin.from("teachers").select("id", { count: "exact", head: true }).eq("school_id", schoolId).is("deactivated_at", null),
    admin.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
  ]);

  const steps: { done: boolean; title: string; detail: string; href: string; cta: string }[] = [
    {
      done: (teacherCount ?? 0) > 0,
      title: "Invite your teachers",
      detail:
        (teacherCount ?? 0) > 0
          ? `${teacherCount} teacher${teacherCount === 1 ? "" : "s"} on board. Invite more any time — each gets a one-click sign-in email, nothing to install.`
          : "Type an email on the Teachers page — they get ONE email with a one-click sign-in button. Nothing to install, nothing to configure.",
      href: "/admin/teachers",
      cta: "Invite teachers",
    },
    {
      done: hasSchedule,
      title: "Set your bell schedule",
      detail: hasSchedule
        ? "Schedule is set — teachers see your real periods."
        : "Upload your bell schedule (a PDF is perfect — it's read automatically). Until then, teachers see a generic 8-period day, which also works fine.",
      href: "/admin/upload-schedule",
      cta: "Upload schedule",
    },
    {
      done: (studentCount ?? 0) > 0,
      title: "Teachers add their students",
      detail:
        (studentCount ?? 0) > 0
          ? `${studentCount} student${studentCount === 1 ? "" : "s"} being tracked.`
          : "Teachers add students from their own dashboard (paste a list of names — 30 seconds). You don't need to do anything here.",
      href: "/admin/usage",
      cta: "Watch usage",
    },
    {
      done: false,
      title: "Decide your family-link policy",
      detail: `Teachers can send parents, students, and co-teachers secure progress links — no accounts needed. Currently ${linksOn} of 3 link types are enabled. Your call, enforced school-wide.`,
      href: "/admin/links",
      cta: "Set link policy",
    },
    ...(isNps
      ? [
          {
            done: false,
            title: "Know your records view",
            detail:
              "As the director you can open any student's full record — every score, every note (shared and private), every teacher. Each open is logged in your audit trail.",
            href: "/admin/records",
            cta: "Student records",
          },
        ]
      : []),
  ];

  const teacherBlurb = [
    `Hi team — we're starting with DailyWins (dailywins.school), a behavior/goal tracker built by teachers.`,
    ``,
    `What it asks of you: about 30 seconds per class period. Your roster appears as a grid — tap to mark each goal a student met. That's it. No save button, no syncing, no binder.`,
    ``,
    `What you get back: daily/weekly/monthly progress charts that build themselves, printable progress reports for meetings, and (if you want) secure links for parents — no parent accounts needed.`,
    ``,
    `Getting in: you'll receive an email from DailyWins with a one-click sign-in button. Click it and you're in — add your students (paste a list of names) and customize your five goal labels to match how you track.`,
    ``,
    `Phones, tablets, Chromebooks all work. Questions → ${user.email}`,
  ].join("\n");

  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>
              {isNps ? "· Director home ·" : "· Site admin home ·"}
            </div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>
              Welcome to {schoolName}&apos;s DailyWins
            </h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>
              {isNps
                ? "You run this — every tab above is yours. Here's the path from empty to up-and-running."
                : "Your school-administration hub. Here's the path from empty to up-and-running."}
            </p>
          </div>
          <SignOutButton />
        </header>

        <SiteAdminNav current="home" />

        {/* Getting-started checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {steps.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--ssd-surface)",
                border: "1px solid var(--ssd-border)",
                borderLeft: `3px solid ${s.done ? "var(--ssd-green)" : "var(--ssd-amber)"}`,
                borderRadius: "var(--ssd-radius)",
                padding: "14px 16px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800,
                  background: s.done ? "var(--ssd-green)" : "var(--ssd-surface-alt)",
                  color: s.done ? "#fff" : "var(--ssd-text-muted)",
                }}
              >
                {s.done ? "✓" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ssd-ink)" }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", lineHeight: 1.5 }}>{s.detail}</div>
              </div>
              <a
                href={s.href}
                style={{
                  fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 999,
                  textDecoration: "none", flexShrink: 0,
                  background: s.done ? "var(--ssd-surface)" : "var(--ssd-green-deep)",
                  color: s.done ? "var(--ssd-green-deep)" : "#fff",
                  border: s.done ? "1px solid var(--ssd-border)" : "none",
                }}
              >
                {s.cta}
              </a>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", padding: "20px 22px", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ssd-text-muted)", marginBottom: 12 }}>
            How DailyWins works — the 60-second version
          </div>
          <ol style={{ margin: 0, paddingLeft: 22, fontSize: 14, lineHeight: 1.7, color: "var(--ssd-text)" }}>
            <li><strong>Teachers tap.</strong> Each period, each student: tap the goals they met. ~30 seconds, on any device. Goal labels are the teacher&apos;s own words (IEP language welcome).</li>
            <li><strong>The record builds itself.</strong> Every tap is a dated data point — daily, weekly, and monthly charts grade themselves on a four-zone scale.</li>
            <li><strong>Reports are one click.</strong> Weekly/monthly PDF progress reports with goal trends, built for IEP meetings, readable on a black-and-white copier.</li>
            <li><strong>Families &amp; team, if you choose.</strong> Secure links (no accounts) for parents, students, and co-teachers/paras — governed entirely by your link policy.</li>
            {isNps ? (
              <li><strong>You see everything.</strong> The Student records tab shows any student&apos;s complete record — every score and note in your school, with the access trail audited.</li>
            ) : null}
          </ol>
        </div>

        {/* Send this to your teachers */}
        <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", padding: "20px 22px" }}>
          <div style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ssd-text-muted)", marginBottom: 6 }}>
            Send this to your teachers
          </div>
          <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", marginBottom: 12 }}>
            A ready-to-send staff note. Copy it into your staff email / Slack — then invite them from the
            Teachers tab and the sign-in button lands in their inbox.
          </div>
          <CopyBlock text={teacherBlurb} />
        </div>
      </div>
    </main>
  );
}

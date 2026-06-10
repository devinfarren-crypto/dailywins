import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import SignOutButton from "@/src/components/SignOutButton";
import NotesArchiveClient from "./NotesArchiveClient";

export const metadata: Metadata = { title: "Notes archive — DailyWins" };
export const dynamic = "force-dynamic";

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

// District records access: every note in the district, behind a typed reason
// and a permanent audit entry. District admins and founders only.
export default async function NotesArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: roleRows } = await admin
    .from("role_assignments")
    .select("role, district_id")
    .eq("user_id", user.id);
  const roles = (roleRows ?? []).map((r) => r.role);
  const isFounder = roles.includes("founder");
  const isDistrictAdmin = roles.includes("district_admin");
  if (!isFounder && !isDistrictAdmin) redirect("/auth/home");

  // Founders may target a district (?district=); district admins are scoped
  // by the RPC itself, no param needed.
  const { district: districtParam } = await searchParams;
  let districtPicker: { id: string; name: string }[] = [];
  if (isFounder) {
    const { data: districts } = await admin.from("districts").select("id, name").order("name");
    districtPicker = districts ?? [];
  }
  const districtId = isFounder ? districtParam ?? districtPicker[0]?.id ?? null : null;

  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>· District records ·</div>
            <h1 style={{ fontFamily: DISPLAY, fontSize: 32, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 4px" }}>
              Notes archive
            </h1>
            <p style={{ fontSize: 14, color: "var(--ssd-text-muted)", margin: 0 }}>
              The district&apos;s complete note record — reason-gated, every access audited.
            </p>
          </div>
          <SignOutButton />
        </header>

        {isFounder && districtPicker.length > 1 ? (
          <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {districtPicker.map((d) => (
              <a
                key={d.id}
                href={`/admin/notes-archive?district=${d.id}`}
                style={{
                  fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 999,
                  textDecoration: "none", border: "1px solid var(--ssd-border)",
                  background: d.id === districtId ? "var(--ssd-green)" : "var(--ssd-surface)",
                  color: d.id === districtId ? "#fff" : "var(--ssd-text-muted)",
                }}
              >
                {d.name}
              </a>
            ))}
          </div>
        ) : null}

        <NotesArchiveClient districtId={districtId} key={districtId ?? "own"} />

        <p style={{ marginTop: 28, fontSize: 12, color: "var(--ssd-text-muted)", lineHeight: 1.5, maxWidth: 720 }}>
          Notes are part of the educational record and may be subject to records requests or legal
          discovery. Day-to-day administrator views remain aggregate-only; this archive is the
          deliberate exception, and every use of it — who, when, and the stated reason — is written
          to the same audit log your district can review.
        </p>
      </div>
    </main>
  );
}

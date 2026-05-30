import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import BreakGlassClient, { type CandidateRow } from "./BreakGlassClient";

export const metadata: Metadata = {
  title: "Break-glass — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AdminBreakGlassPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  // Break-glass is founder-only (mirrors canBreakGlass()). Anyone else is
  // bounced to the dashboard before we load any candidate identities.
  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("role_assignments")
    .select("user_id, role")
    .eq("user_id", user.id);

  const isFounder = roles?.some((r) => r.role === "founder") ?? false;
  if (!isFounder) redirect("/dashboard");

  // Break-glass can target ANY user (including other admins/founders), so the
  // candidate list is the union of teachers + every role-assignment holder.
  // Teacher identity is canonical; non-teacher admins resolve through
  // access_requests, the same fallback the in-session banner uses.
  const candidates = new Map<string, CandidateRow>();

  const { data: teachers } = await admin
    .from("teachers")
    .select("auth_id, full_name, email, schools(name, district)")
    .order("full_name", { ascending: true });

  for (const t of teachers ?? []) {
    if (!t.auth_id || t.auth_id === user.id) continue;
    const school = (t.schools as { name?: string } | null)?.name ?? null;
    const district = (t.schools as { district?: string } | null)?.district ?? null;
    candidates.set(t.auth_id, {
      auth_id: t.auth_id,
      full_name: t.full_name ?? "(unnamed)",
      email: t.email ?? "",
      detail: school ? (district ? `${school} · ${district}` : school) : "Teacher",
      is_admin: false,
    });
  }

  const { data: allRoles } = await admin
    .from("role_assignments")
    .select("user_id, role");

  // Collapse multiple role rows per user into one label ("founder, site_admin").
  const roleLabels = new Map<string, string[]>();
  for (const r of allRoles ?? []) {
    if (!r.user_id) continue;
    const list = roleLabels.get(r.user_id) ?? [];
    if (!list.includes(r.role)) list.push(r.role);
    roleLabels.set(r.user_id, list);
  }

  const adminIdsNeedingIdentity = [...roleLabels.keys()].filter(
    (id) => id !== user.id && !candidates.has(id)
  );

  if (adminIdsNeedingIdentity.length > 0) {
    const { data: requests } = await admin
      .from("access_requests")
      .select("user_id, full_name, email")
      .in("user_id", adminIdsNeedingIdentity);
    const identity = new Map(
      (requests ?? []).map((r) => [r.user_id, r])
    );
    for (const id of adminIdsNeedingIdentity) {
      const who = identity.get(id);
      candidates.set(id, {
        auth_id: id,
        full_name: who?.full_name ?? "(unnamed admin)",
        email: who?.email ?? "",
        detail: (roleLabels.get(id) ?? []).join(", ") || "Admin",
        is_admin: true,
      });
    }
  }

  // Mark teacher-candidates who also hold an admin role so the founder knows
  // they're reaching past a plain teacher account.
  for (const [id, row] of candidates) {
    if (!row.is_admin && roleLabels.has(id)) {
      row.detail = `${row.detail} · ${(roleLabels.get(id) ?? []).join(", ")}`;
      row.is_admin = true;
    }
  }

  const list = [...candidates.values()].sort((a, b) =>
    a.full_name.localeCompare(b.full_name)
  );

  return <BreakGlassClient candidates={list} />;
}

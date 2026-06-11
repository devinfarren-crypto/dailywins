import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import ScheduleUploader, {
  type SchoolOption,
} from "@/src/components/ScheduleUploader";
import SiteAdminNav from "@/src/components/SiteAdminNav";
import AdminNavyBand from "@/src/components/AdminNavyBand";
import SignOutButton from "@/src/components/SignOutButton";
import type { Schedules } from "@/src/lib/schedules-schema";

// Reads auth cookies + per-user admin scope, so it must render per-request.
export const dynamic = "force-dynamic";

/**
 * Site Admin bell-schedule manager.
 *
 * Loads the schools the signed-in user can manage. Founders see every school
 * (matches the save route's founder-implicit authz); everyone else is scoped to
 * the schools they admin — via `role_assignments` (site_admin, the modern source
 * of truth) unioned with the legacy `school_admins` table. The save route accepts
 * the same union, so the picker stays consistent with what it will accept. Each
 * school is handed over with its current stored schedules to the uploader/editor.
 *
 * Auth: redirects unauthenticated users to the landing page. A signed-in user
 * who admins no schools gets an explanatory empty state. The school_admins +
 * schools reads run through the service-role client because a Site Admin may
 * administer a school they don't teach at (RLS would hide that schools row) —
 * authorization is still scoped explicitly by user.id (or founder role).
 */
export default async function UploadSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const admin = createAdminClient();

  // Founders manage every school; everyone else is scoped to their
  // school_admins rows. has_role() runs as the caller (auth.uid/effective).
  const { data: founderCheck } = await supabase.rpc("has_role", {
    p_role: "founder",
  });
  const isFounder = founderCheck === true;

  let schoolRows:
    | { id: string; name: string; schedules: Schedules }[]
    | null = null;
  if (isFounder) {
    ({ data: schoolRows } = await admin
      .from("schools")
      .select("id, name, schedules")
      .order("name"));
  } else {
    // Union the modern source (role_assignments site_admin) with the legacy
    // school_admins table so both provisioning paths can manage schedules while
    // school_admins is being retired.
    const [{ data: legacyRows }, { data: roleRows }] = await Promise.all([
      admin.from("school_admins").select("school_id").eq("user_id", user.id),
      admin
        .from("role_assignments")
        .select("school_id")
        .eq("user_id", user.id)
        .eq("role", "site_admin"),
    ]);
    const schoolIds = [
      ...new Set(
        [
          ...(legacyRows ?? []).map((r) => r.school_id as string),
          ...(roleRows ?? []).map((r) => r.school_id as string),
        ].filter(Boolean),
      ),
    ];
    if (schoolIds.length > 0) {
      ({ data: schoolRows } = await admin
        .from("schools")
        .select("id, name, schedules")
        .in("id", schoolIds)
        .order("name"));
    }
  }

  const schools: SchoolOption[] = (schoolRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    schedules: (s.schedules as Schedules) ?? null,
  }));

  return (
    <main style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <SignOutButton />
      </div>
      {!isFounder ? <SiteAdminNav current="schedules" /> : null}
      {schools.length === 0 ? (
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#5a6e66",
          }}
        >
          <AdminNavyBand title="Bell schedules" sub="Nothing to manage yet." />
          <p style={{ fontSize: 15, color: "#8a9690" }}>
            You aren&apos;t set up as an admin of any school yet, so there&apos;s
            nothing to manage here. Ask a founder to add you as a Site Admin.
          </p>
        </div>
      ) : (
        <ScheduleUploader schools={schools} />
      )}
    </main>
  );
}

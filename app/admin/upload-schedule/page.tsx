import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import ScheduleUploader, {
  type SchoolOption,
} from "@/src/components/ScheduleUploader";
import type { Schedules } from "@/src/lib/schedules-schema";

// Reads auth cookies + per-user admin scope, so it must render per-request.
export const dynamic = "force-dynamic";

/**
 * Site Admin bell-schedule manager.
 *
 * Loads the schools the signed-in user administers (their `school_admins` rows —
 * the same table is_school_admin() checks, so the picker stays consistent with
 * what the save route will accept) and hands them, with their current stored
 * schedules, to the uploader/editor.
 *
 * Auth: redirects unauthenticated users to the landing page. A signed-in user
 * who admins no schools gets an explanatory empty state. The school_admins +
 * schools reads run through the service-role client because a Site Admin may
 * administer a school they don't teach at (RLS would hide that schools row) —
 * authorization is still scoped explicitly by user.id.
 */
export default async function UploadSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const admin = createAdminClient();

  const { data: adminRows } = await admin
    .from("school_admins")
    .select("school_id")
    .eq("user_id", user.id);

  const schoolIds = (adminRows ?? []).map((r) => r.school_id as string);

  let schools: SchoolOption[] = [];
  if (schoolIds.length > 0) {
    const { data: schoolRows } = await admin
      .from("schools")
      .select("id, name, schedules")
      .in("id", schoolIds)
      .order("name");

    schools = (schoolRows ?? []).map((s) => ({
      id: s.id as string,
      name: s.name as string,
      schedules: (s.schedules as Schedules) ?? null,
    }));
  }

  return (
    <main style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      {schools.length === 0 ? (
        <div
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#5a6e66",
          }}
        >
          <h2
            style={{
              color: "#2a4d42",
              fontSize: 24,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            Bell schedules
          </h2>
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

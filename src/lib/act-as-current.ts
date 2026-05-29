import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

// Server-side helper for the act-as banner + any page that needs to know
// whether the current request is being served as part of an open session.
//
// Returns null when no active session exists (most page loads) so callers
// can early-return cheaply. Reads via the admin client to bypass RLS on
// act_as_sessions — equivalent to what effective_user_id() does internally.

export interface ActAsSessionInfo {
  session_id: string;
  target_user_id: string;
  target_email: string;
  target_full_name: string;
  break_glass: boolean;
  reason: string | null;
  started_at: string;
  expires_at: string;
}

export async function getCurrentActAsSession(): Promise<ActAsSessionInfo | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from("act_as_sessions")
    .select("id, target_user_id, break_glass, reason, started_at, expires_at, ended_at")
    .eq("actor_user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentActAsSession query failed", error);
    return null;
  }
  if (!session) return null;

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }

  // Fetch target identity — teacher row first (most common), fall back to
  // auth.users for break-glass against admin/founder targets.
  const { data: targetTeacher } = await admin
    .from("teachers")
    .select("full_name, email")
    .eq("auth_id", session.target_user_id)
    .maybeSingle();

  let targetEmail = targetTeacher?.email ?? "";
  let targetFullName = targetTeacher?.full_name ?? "";

  if (!targetEmail) {
    const { data: authRow } = await admin
      .from("access_requests")
      .select("email, full_name")
      .eq("user_id", session.target_user_id)
      .maybeSingle();
    targetEmail = authRow?.email ?? "unknown";
    targetFullName = authRow?.full_name ?? "(unknown)";
  }

  return {
    session_id: session.id,
    target_user_id: session.target_user_id,
    target_email: targetEmail,
    target_full_name: targetFullName,
    break_glass: session.break_glass,
    reason: session.reason,
    started_at: session.started_at,
    expires_at: session.expires_at,
  };
}

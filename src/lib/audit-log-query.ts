import type { SupabaseClient } from "@supabase/supabase-js";

// Reads from public.audit_log and enriches each row with actor + acting_as
// emails via a server-side join through auth.users (which is RLS-blocked from
// the client). Always use the service-role admin client when calling these
// helpers — the page-level gate is responsible for authorization, not RLS on
// audit_log (we *want* the admin client read so the founder view shows
// everything, and the teacher self-serve view scopes by user_id explicitly).

export interface EnrichedAuditRow {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string;
  actor_email: string | null;
  acting_as_user_id: string | null;
  acting_as_email: string | null;
  target_table: string | null;
  target_id: string | null;
  break_glass: boolean;
  reason: string | null;
  before: unknown;
  after: unknown;
}

type RawAuditRow = {
  id: string;
  created_at: string;
  action: string;
  actor_user_id: string;
  acting_as_user_id: string | null;
  target_table: string | null;
  target_id: string | null;
  break_glass: boolean;
  reason: string | null;
  before: unknown;
  after: unknown;
};

async function enrichWithEmails(
  admin: SupabaseClient,
  rows: RawAuditRow[]
): Promise<EnrichedAuditRow[]> {
  if (rows.length === 0) return [];

  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.actor_user_id);
    if (r.acting_as_user_id) ids.add(r.acting_as_user_id);
  }

  // auth.users is queryable via the service-role admin client.
  const { data: users } = await admin
    .schema("auth")
    .from("users")
    .select("id, email")
    .in("id", Array.from(ids));

  const emailById = new Map<string, string>();
  for (const u of users ?? []) {
    if (u.id && u.email) emailById.set(u.id, u.email);
  }

  return rows.map((r) => ({
    ...r,
    actor_email: emailById.get(r.actor_user_id) ?? null,
    acting_as_email: r.acting_as_user_id
      ? emailById.get(r.acting_as_user_id) ?? null
      : null,
  }));
}

export async function listAllAuditRows(
  admin: SupabaseClient,
  limit = 200
): Promise<EnrichedAuditRow[]> {
  const { data, error } = await admin
    .from("audit_log")
    .select(
      "id, created_at, action, actor_user_id, acting_as_user_id, target_table, target_id, break_glass, reason, before, after"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listAllAuditRows failed", error);
    return [];
  }
  return enrichWithEmails(admin, (data ?? []) as RawAuditRow[]);
}

export async function listAuditRowsAboutUser(
  admin: SupabaseClient,
  userId: string,
  limit = 100
): Promise<EnrichedAuditRow[]> {
  const { data, error } = await admin
    .from("audit_log")
    .select(
      "id, created_at, action, actor_user_id, acting_as_user_id, target_table, target_id, break_glass, reason, before, after"
    )
    .eq("acting_as_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listAuditRowsAboutUser failed", error);
    return [];
  }
  return enrichWithEmails(admin, (data ?? []) as RawAuditRow[]);
}

export async function listAuditRowsByUser(
  admin: SupabaseClient,
  userId: string,
  limit = 100
): Promise<EnrichedAuditRow[]> {
  const { data, error } = await admin
    .from("audit_log")
    .select(
      "id, created_at, action, actor_user_id, acting_as_user_id, target_table, target_id, break_glass, reason, before, after"
    )
    .eq("actor_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listAuditRowsByUser failed", error);
    return [];
  }
  return enrichWithEmails(admin, (data ?? []) as RawAuditRow[]);
}

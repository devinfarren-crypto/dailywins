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

  // The auth schema is NOT exposed through PostgREST (the old .schema("auth")
  // query silently returned nothing → raw UUIDs in the audit UI). Resolve
  // emails from public tables instead: every teacher and every approved
  // admin/director has a row in teachers or access_requests.
  const idList = Array.from(ids);
  const emailById = new Map<string, string>();
  const [{ data: teacherRows }, { data: requestRows }] = await Promise.all([
    admin.from("teachers").select("auth_id, email").in("auth_id", idList),
    admin.from("access_requests").select("user_id, email").in("user_id", idList),
  ]);
  for (const r of requestRows ?? []) {
    if (r.user_id && r.email) emailById.set(r.user_id, r.email);
  }
  for (const t of teacherRows ?? []) {
    if (t.auth_id && t.email) emailById.set(t.auth_id, t.email);
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

// Trigger-written rows on these tables carry full row snapshots in before/after
// — student PII. District/site admins are PII-blind (migration 035), so the
// scoped view excludes them entirely; only the founder view may include them.
const PII_TABLES = new Set(["behavior_scores", "notes", "students"]);

// EXCEPTION: NPS-director record opens (047) are written with
// target_table='students' but carry NO row data — just ids. They ARE the
// access trail the records page promises ("each record you open is noted in
// the audit log"), so hiding them broke that promise for the only person it
// was made to (caught in the 2026-06-11 external console review).
function isPiiHidden(row: RawAuditRow): boolean {
  if (!row.target_table || !PII_TABLES.has(row.target_table)) return false;
  return !row.action.startsWith("nps_record.");
}

/**
 * Scoped audit read for district/site admins: rows where the actor (or the
 * acted-as user) is someone in the admin's domain, with PII-table rows
 * excluded. The caller resolves the domain to a set of auth user ids.
 */
export async function listScopedAuditRows(
  admin: SupabaseClient,
  userIds: string[],
  limit = 200
): Promise<EnrichedAuditRow[]> {
  if (userIds.length === 0) return [];
  const inList = `(${userIds.join(",")})`;
  const { data, error } = await admin
    .from("audit_log")
    .select(
      "id, created_at, action, actor_user_id, acting_as_user_id, target_table, target_id, break_glass, reason, before, after"
    )
    .or(`actor_user_id.in.${inList},acting_as_user_id.in.${inList}`)
    .order("created_at", { ascending: false })
    .limit(limit * 2); // headroom — PII-table rows are dropped below

  if (error) {
    console.error("listScopedAuditRows failed", error);
    return [];
  }
  const scoped = ((data ?? []) as RawAuditRow[])
    .filter((r) => !isPiiHidden(r))
    .slice(0, limit);
  return enrichWithEmails(admin, scoped);
}

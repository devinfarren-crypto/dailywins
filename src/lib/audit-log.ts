import type { SupabaseClient } from "@supabase/supabase-js";

// Append-only writes to public.audit_log. All admin actions should funnel
// through this helper so we have one place to audit (and one place to update
// when the table shape evolves).
//
// Writes use the service-role admin client because the audit_log table has
// no INSERT policy by design — only this helper, called from server code,
// should write to it.

export interface AuditLogEntry {
  actor_user_id: string;
  acting_as_user_id?: string | null;
  action: string;
  target_table?: string | null;
  target_id?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  break_glass?: boolean;
}

export async function writeAuditLog(
  admin: SupabaseClient,
  entry: AuditLogEntry
): Promise<void> {
  const { error } = await admin.from("audit_log").insert({
    actor_user_id: entry.actor_user_id,
    acting_as_user_id: entry.acting_as_user_id ?? null,
    action: entry.action,
    target_table: entry.target_table ?? null,
    target_id: entry.target_id ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
    break_glass: entry.break_glass ?? false,
  });

  if (error) {
    // Audit log write failure is serious but should not break the user-facing
    // action that triggered it. Surface to server logs; consider alerting
    // once monitoring is wired up.
    console.error("audit_log write failed", { entry, error });
  }
}

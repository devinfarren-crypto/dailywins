// Client-side helper for firing audit events after successful writes.
// Fire-and-forget by design — the audit endpoint silently no-ops when the
// caller isn't act-as'd, so this is cheap to call on every write. Errors
// are swallowed (logged to console) so audit-pipeline failures never break
// the user-facing action that just succeeded.

export interface AuditEventInput {
  action: string;
  target_table?: string;
  target_id?: string;
  before?: unknown;
  after?: unknown;
}

export function fireAuditEvent(input: AuditEventInput): void {
  // Intentionally not awaited.
  fetch("/api/audit/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
    keepalive: true, // survive page-unload races
  })
    .then((res) => {
      if (!res.ok) {
        console.warn("audit event failed", res.status, input.action);
      }
    })
    .catch((err) => {
      console.warn("audit event error", err, input.action);
    });
}

"use client";

// Revoke controls for the site-admin link oversight page. The list itself is
// server-rendered (page.tsx); this component owns the per-row revoke action:
// confirm → revoke_magic_link RPC (security definer re-checks the caller's
// role and writes the audit row) → router.refresh() to re-pull the list.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";

const SCOPE_LABELS: Record<string, string> = {
  parent: "Parent",
  student: "Student",
  co_teacher: "Co-teacher",
};

export interface SchoolLinkRow {
  id: string;
  scope_type: string;
  access: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  use_count: number;
  last_used_at: string | null;
  teacher_name: string;
}

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function statusOf(row: SchoolLinkRow): { label: string; color: string } {
  if (row.revoked_at) return { label: "Revoked", color: "var(--ssd-text-muted)" };
  if (new Date(row.expires_at) < new Date()) return { label: "Expired", color: "var(--ssd-status-working)" };
  return { label: "Active", color: "var(--ssd-green-deep)" };
}

const th: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--ssd-font-mono), monospace",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ssd-text-muted)",
  padding: "8px 12px",
  borderBottom: "1px solid var(--ssd-border)",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 14,
  color: "var(--ssd-text)",
  borderBottom: "1px solid var(--ssd-border)",
};

export default function LinksClient({ rows }: { rows: SchoolLinkRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusyId(id);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("revoke_magic_link", { p_link_id: id });
    setBusyId(null);
    setConfirmId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
      {error ? (
        <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--ssd-status-support)", borderBottom: "1px solid var(--ssd-border)" }}>
          Couldn&apos;t revoke: {error}
        </div>
      ) : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Teacher</th>
            <th style={th}>Type</th>
            <th style={th}>Access</th>
            <th style={th}>Created</th>
            <th style={th}>Expires</th>
            <th style={th}>Uses</th>
            <th style={th}>Last used</th>
            <th style={th}>Status</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td style={td} colSpan={9}>
                No links at this school yet. Teachers create them from the dashboard&apos;s Manage Links.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const status = statusOf(row);
              const revocable = !row.revoked_at && new Date(row.expires_at) >= new Date();
              return (
                <tr key={row.id} style={row.revoked_at ? { opacity: 0.55 } : undefined}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--ssd-ink)" }}>{row.teacher_name}</td>
                  <td style={td}>{SCOPE_LABELS[row.scope_type] ?? row.scope_type}</td>
                  <td style={td}>{row.access === "readwrite" ? "Read + write" : "Read-only"}</td>
                  <td style={td}>{fmt(row.created_at)}</td>
                  <td style={td}>{fmt(row.expires_at)}</td>
                  <td style={td}>{row.use_count}</td>
                  <td style={td}>{fmt(row.last_used_at)}</td>
                  <td style={{ ...td, color: status.color, fontWeight: 600 }}>{status.label}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {revocable ? (
                      confirmId === row.id ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            onClick={() => revoke(row.id)}
                            disabled={busyId === row.id}
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--ssd-status-support)",
                              background: "var(--ssd-status-support)",
                              color: "#fff",
                              cursor: busyId === row.id ? "wait" : "pointer",
                            }}
                          >
                            {busyId === row.id ? "Revoking…" : "Confirm revoke"}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            disabled={busyId === row.id}
                            style={{
                              fontSize: 12,
                              padding: "5px 10px",
                              borderRadius: 6,
                              border: "1px solid var(--ssd-border)",
                              background: "var(--ssd-surface)",
                              color: "var(--ssd-text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmId(row.id)}
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "5px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--ssd-status-support)",
                            background: "var(--ssd-surface)",
                            color: "var(--ssd-status-support)",
                            cursor: "pointer",
                          }}
                        >
                          Revoke
                        </button>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

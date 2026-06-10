"use client";

// District notes archive: reason-gated access to every note in the district
// (including private ones) for records/legal purposes. Nothing loads until a
// specific reason is typed; the RPC writes the audit row before returning a
// single note. CSV export included — records requests want a file.

import { useState } from "react";
import { createClient } from "@/src/lib/supabase";

interface NoteRow {
  note_id: string;
  note_date: string;
  period: string | null;
  school_name: string;
  teacher_name: string;
  student_name: string;
  is_private: boolean;
  content: string;
  created_at: string;
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
  fontSize: 13.5,
  color: "var(--ssd-text)",
  borderBottom: "1px solid var(--ssd-border)",
  verticalAlign: "top",
};

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export default function NotesArchiveClient({ districtId }: { districtId: string | null }) {
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<NoteRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("district_notes_archive", {
      p_reason: reason,
      ...(districtId ? { p_district_id: districtId } : {}),
    });
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRows((data ?? []) as NoteRow[]);
  }

  function downloadCsv() {
    if (!rows) return;
    const header = "Date,Period,School,Teacher,Student,Visibility,Note";
    const lines = rows.map((r) =>
      [
        r.note_date,
        r.period ?? "",
        r.school_name,
        r.teacher_name,
        r.student_name,
        r.is_private ? "Private" : "Shared",
        r.content,
      ]
        .map(csvEscape)
        .join(",")
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dailywins-notes-archive-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows === null) {
    return (
      <div
        style={{
          background: "var(--ssd-surface)",
          border: "1px solid var(--ssd-border)",
          borderRadius: "var(--ssd-radius)",
          padding: "22px 24px",
          maxWidth: 640,
        }}
      >
        <div style={{ fontSize: 14, color: "var(--ssd-text)", lineHeight: 1.55, marginBottom: 14 }}>
          This opens <strong>every note recorded in your district — including teachers&apos; private
          notes</strong>. It exists for records purposes: records requests, due-process preparation,
          and district review. The access itself is permanently written to the audit log with the
          reason you give below.
        </div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--ssd-ink)", marginBottom: 6 }}>
          Reason for access (required, logged)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder='e.g. "Records request from parent counsel re: Student A, case 26-1142"'
          style={{
            width: "100%",
            fontSize: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--ssd-border)",
            background: "var(--ssd-paper)",
            color: "var(--ssd-text)",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        {error ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--ssd-status-support)" }}>{error}</div>
        ) : null}
        <button
          onClick={open}
          disabled={loading || reason.trim().length < 10}
          style={{
            marginTop: 14,
            fontSize: 14,
            fontWeight: 700,
            padding: "10px 18px",
            borderRadius: 999,
            border: "none",
            background: reason.trim().length >= 10 ? "var(--ssd-ink)" : "var(--ssd-border)",
            color: reason.trim().length >= 10 ? "#fff" : "var(--ssd-text-muted)",
            cursor: reason.trim().length >= 10 ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Opening…" : "Open notes archive (logged)"}
        </button>
        {reason.trim().length > 0 && reason.trim().length < 10 ? (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ssd-text-muted)" }}>
            Please give a specific reason (at least 10 characters).
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ssd-text-muted)" }}>
          {rows.length} note{rows.length === 1 ? "" : "s"} · access logged to the audit trail
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={downloadCsv}
            style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 999, border: "1px solid var(--ssd-border)", background: "var(--ssd-surface)", color: "var(--ssd-ink)", cursor: "pointer" }}
          >
            Download CSV
          </button>
          <button
            onClick={() => window.print()}
            style={{ fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 999, border: "1px solid var(--ssd-border)", background: "var(--ssd-surface)", color: "var(--ssd-ink)", cursor: "pointer" }}
          >
            Print
          </button>
        </div>
      </div>
      <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Period</th>
              <th style={th}>School</th>
              <th style={th}>Teacher</th>
              <th style={th}>Student</th>
              <th style={th}>Visibility</th>
              <th style={th}>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td style={td} colSpan={7}>No notes recorded in this district yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.note_id}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{r.note_date}</td>
                  <td style={td}>{r.period ?? "—"}</td>
                  <td style={td}>{r.school_name}</td>
                  <td style={td}>{r.teacher_name}</td>
                  <td style={{ ...td, fontWeight: 600, color: "var(--ssd-ink)" }}>{r.student_name}</td>
                  <td style={{ ...td, color: r.is_private ? "var(--ssd-status-support)" : "var(--ssd-green-deep)", fontWeight: 600 }}>
                    {r.is_private ? "Private" : "Shared"}
                  </td>
                  <td style={{ ...td, maxWidth: 420, whiteSpace: "pre-wrap" }}>{r.content}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

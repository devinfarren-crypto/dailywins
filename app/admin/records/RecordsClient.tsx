"use client";

// NPS director records view: the school roster, and per-student the full
// record — behavior charts (the same BehaviorCharts the magic links use,
// fed by nps_get_student_record) plus EVERY note, shared and private, with
// teacher attribution. Server page gates to NPS site admins; the RPCs
// re-check and audit each record open.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/src/lib/supabase";
import { fireAuditEvent } from "@/src/lib/audit-event-client";
import BehaviorCharts, {
  type CategoryDef,
  type ChartScoreRow,
} from "@/src/components/BehaviorCharts";

interface RosterRow {
  id: string;
  display_name: string;
  teacher_names: string | null;
  last_score_date: string | null;
  scores_30d: number;
  notes_count: number;
  archived_at: string | null;
}

interface RecordNote {
  id: string;
  note_date: string;
  period: string | null;
  content: string;
  is_private: boolean;
  teacher_name: string | null;
}

interface StudentRecord {
  student: { id: string; display_name: string; archived_at?: string | null } | null;
  categories: CategoryDef[];
  // Migration 050: each scoring teacher's config — rows are computed against
  // the config they were written under.
  categories_by_teacher?: Record<string, CategoryDef[]> | null;
  scores: ChartScoreRow[];
  notes: RecordNote[];
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

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

export default function RecordsClient({
  schoolId,
  schoolName = "Your school",
  userEmail = "",
}: {
  schoolId: string;
  schoolName?: string;
  userEmail?: string;
}) {
  const [roster, setRoster] = useState<RosterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RosterRow | null>(null);
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Compliance date range — placing districts ask for THEIR window ("March 1
  // to May 31"), not a rolling one. Empty = everything on file.
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  const inRange = useCallback(
    (d: string) => (!rangeFrom || d >= rangeFrom) && (!rangeTo || d <= rangeTo),
    [rangeFrom, rangeTo]
  );
  const filteredScores = useMemo(
    () => (record ? record.scores.filter((s) => inRange(s.score_date)) : []),
    [record, inRange]
  );
  const filteredNotes = useMemo(
    () => (record ? record.notes.filter((n) => inRange(n.note_date)) : []),
    [record, inRange]
  );
  const rangeLabel =
    rangeFrom || rangeTo ? `${rangeFrom || "start"} to ${rangeTo || "today"}` : null;

  // Print everything on this page — charts, the category breakdown, and every
  // note in the selected range — as one branded PDF. The export itself is
  // audited (nps_record.print) and the document is stamped with who made it.
  // jspdf is browser-only, so the generator is imported inside the handler.
  const printPdf = useCallback(async (row: RosterRow, rec: StudentRecord) => {
    setPdfBusy(true);
    try {
      fireAuditEvent({
        action: "nps_record.print",
        target_table: "students",
        target_id: rec.student?.id ?? row.id,
      });
      const { generateStudentRecordPdf } = await import("@/src/lib/student-record-pdf");
      await generateStudentRecordPdf({
        studentName: rec.student?.display_name ?? row.display_name,
        schoolName,
        generatedBy: userEmail,
        scores: filteredScores,
        categories: rec.categories,
        categoriesByTeacher: rec.categories_by_teacher ?? null,
        notes: filteredNotes,
        rangeLabel,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setPdfBusy(false);
    }
  }, [schoolName, userEmail, filteredScores, filteredNotes, rangeLabel]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("nps_list_school_students", {
        p_school_id: schoolId,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      setRoster((data ?? []) as RosterRow[]);
    })();
  }, [schoolId]);

  const open = useCallback(async (row: RosterRow) => {
    setSelected(row);
    setRecord(null);
    setLoadingRecord(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("nps_get_student_record", {
      p_student_id: row.id,
    });
    setLoadingRecord(false);
    if (rpcError) {
      setError(rpcError.message);
      setSelected(null);
      return;
    }
    setRecord(data as StudentRecord);
  }, []);

  if (error) {
    return (
      <div style={{ fontSize: 14, color: "var(--ssd-status-support)" }}>{error}</div>
    );
  }

  // ── Student detail ──────────────────────────────────────────────────────
  if (selected) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            onClick={() => { setSelected(null); setRecord(null); }}
            style={{
              fontSize: 13, fontWeight: 600, padding: "7px 14px", borderRadius: 999,
              border: "1px solid var(--ssd-border)", background: "var(--ssd-surface)",
              color: "var(--ssd-ink)", cursor: "pointer",
            }}
          >
            ← All students
          </button>
          {record ? (
            <button
              onClick={() => printPdf(selected, record)}
              disabled={pdfBusy}
              style={{
                fontSize: 13, fontWeight: 700, padding: "8px 18px", borderRadius: 999,
                border: "none", background: "var(--ssd-green-deep, #0F6E56)", color: "#fff",
                cursor: pdfBusy ? "wait" : "pointer", opacity: pdfBusy ? 0.7 : 1,
                boxShadow: "0 4px 12px rgba(15,110,86,.25)",
              }}
            >
              {pdfBusy ? "Preparing PDF…" : "Print PDF ↓"}
            </button>
          ) : null}
        </div>
        <h2 style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 24, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
          {selected.display_name}
          {selected.archived_at ? (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a6d1a", background: "#faeeda", border: "1px solid #e8d9b0", borderRadius: 999, padding: "3px 10px" }}>
              Archived — record retained
            </span>
          ) : null}
        </h2>
        {loadingRecord || !record ? (
          <div style={{ fontSize: 14, color: "var(--ssd-text-muted)" }}>Loading record…</div>
        ) : (
          <>
            {/* Compliance date range — what districts actually ask for. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14, fontSize: 13, color: "var(--ssd-text-muted)" }}>
              <span style={{ fontWeight: 600 }}>Date range:</span>
              <input
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                style={{ padding: "6px 8px", border: "1px solid var(--ssd-border)", borderRadius: 8, fontSize: 13, background: "var(--ssd-surface)", color: "var(--ssd-ink)" }}
              />
              <span>to</span>
              <input
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                style={{ padding: "6px 8px", border: "1px solid var(--ssd-border)", borderRadius: 8, fontSize: 13, background: "var(--ssd-surface)", color: "var(--ssd-ink)" }}
              />
              {rangeLabel ? (
                <button
                  onClick={() => { setRangeFrom(""); setRangeTo(""); }}
                  style={{ background: "none", border: "none", color: "var(--ssd-green-deep)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  Clear — show everything
                </button>
              ) : (
                <span style={{ fontSize: 12 }}>showing everything on file · set a range for a district&apos;s reporting window</span>
              )}
            </div>

            <BehaviorCharts
              scores={filteredScores}
              categories={record.categories}
              categoriesByTeacher={record.categories_by_teacher}
            />

            <div style={{ marginTop: 28 }}>
              <div style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ssd-text-muted)", marginBottom: 10 }}>
                Notes — all teachers, shared and private ({filteredNotes.length}
                {rangeLabel ? ` in range · ${record.notes.length} total` : ""})
              </div>
              <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Period</th>
                      <th style={th}>Teacher</th>
                      <th style={th}>Visibility</th>
                      <th style={th}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotes.length === 0 ? (
                      <tr><td style={td} colSpan={5}>{rangeLabel ? "No notes in this date range." : "No notes for this student yet."}</td></tr>
                    ) : (
                      filteredNotes.map((n) => (
                        <tr key={n.id}>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{fmt(n.note_date)}</td>
                          <td style={td}>{n.period ?? "—"}</td>
                          <td style={td}>{n.teacher_name ?? "—"}</td>
                          <td style={{ ...td, fontWeight: 600, color: n.is_private ? "var(--ssd-status-support)" : "var(--ssd-green-deep)" }}>
                            {n.is_private ? "Private" : "Shared"}
                          </td>
                          <td style={{ ...td, maxWidth: 420, whiteSpace: "pre-wrap" }}>{n.content}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Roster ──────────────────────────────────────────────────────────────
  if (roster === null) {
    return <div style={{ fontSize: 14, color: "var(--ssd-text-muted)" }}>Loading students…</div>;
  }

  return (
    <div style={{ background: "var(--ssd-surface)", border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Student</th>
            <th style={th}>Teacher(s)</th>
            <th style={th}>Last tracked</th>
            <th style={th}>Entries 30d</th>
            <th style={th}>Notes</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {roster.length === 0 ? (
            <tr><td style={td} colSpan={6}>No students at this school yet — teachers add them from their dashboards.</td></tr>
          ) : (
            roster.map((r) => (
              <tr key={r.id}>
                <td style={{ ...td, fontWeight: 600, color: r.archived_at ? "var(--ssd-text-muted)" : "var(--ssd-ink)" }}>
                  {r.display_name}
                  {r.archived_at ? (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#8a6d1a", background: "#faeeda", border: "1px solid #e8d9b0", borderRadius: 999, padding: "2px 8px" }}>
                      Archived
                    </span>
                  ) : null}
                </td>
                <td style={td}>{r.teacher_names ?? "—"}</td>
                <td style={td}>{fmt(r.last_score_date)}</td>
                <td style={td}>{r.scores_30d}</td>
                <td style={td}>{r.notes_count}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button
                    onClick={() => open(r)}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999,
                      border: "1px solid var(--ssd-green)", background: "var(--ssd-surface)",
                      color: "var(--ssd-green-deep)", cursor: "pointer",
                    }}
                  >
                    Open record
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

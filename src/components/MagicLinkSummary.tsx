import type { ReactNode } from "react";
import BehaviorCharts, { type CategoryDef } from "@/src/components/BehaviorCharts";

// Shared read-only behavior summary rendered by the parent / student / co-teacher
// magic-link pages. The server shell (header / notes) is presentational; the
// behavior section delegates to the BehaviorCharts client component (daily /
// weekly / monthly charts). Styled to the Sure Step Education design system.

export interface ScoreRow {
  id: string;
  score_date: string;
  period: number;
  scores: Record<string, number | null> | null;
  // Legacy per-category columns (pre-jsonb rows) — used by the chart's fallback.
  arrival?: number | null;
  compliance?: number | null;
  social?: number | null;
  on_task?: number | null;
  phone_away?: boolean | null;
}

export interface NoteRow {
  id: string;
  content: string;
}

export interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
}

const DISPLAY = "var(--ssd-font-display), Georgia, serif";

export function InvalidLinkCard({
  message = "It may have expired or been turned off. Ask the teacher for a new link.",
}: {
  message?: string;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--ssd-paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--ssd-surface)",
          borderRadius: "var(--ssd-radius)",
          border: "1px solid var(--ssd-border)",
          borderTop: "3px solid var(--ssd-status-support)",
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "var(--ssd-shadow)",
        }}
      >
        <h1 style={{ fontFamily: DISPLAY, margin: "0 0 12px", fontSize: 22, fontWeight: 500, color: "var(--ssd-ink)" }}>
          This link is no longer valid
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "var(--ssd-text-muted)", lineHeight: 1.5 }}>
          {message}
        </p>
      </div>
    </main>
  );
}

export default function MagicLinkSummary({
  student,
  scores,
  notes,
  categories,
  eyebrow = "· DailyWins ·",
  subtitle = "Behavior summary",
  banner,
}: {
  student: StudentRow;
  scores: ScoreRow[];
  notes: NoteRow[];
  categories?: CategoryDef[] | null;
  eyebrow?: string;
  subtitle?: string;
  banner?: ReactNode;
}) {
  const fullName =
    `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Student";

  const cardStyle: React.CSSProperties = {
    background: "var(--ssd-surface)",
    border: "1px solid var(--ssd-border)",
    borderRadius: "var(--ssd-radius)",
    padding: "12px 16px",
  };
  const sectionHeading: React.CSSProperties = {
    fontFamily: "var(--ssd-font-mono), ui-monospace, monospace",
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--ssd-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper)", padding: "32px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <div className="ssd-eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
          <h1 style={{ fontFamily: DISPLAY, margin: "0 0 4px", fontSize: 30, fontWeight: 500, color: "var(--ssd-ink)" }}>
            {fullName}
          </h1>
          <div style={{ fontSize: 14, color: "var(--ssd-text-muted)" }}>{subtitle}</div>
        </header>

        {banner}

        <section style={{ marginBottom: 24 }}>
          <h2 style={sectionHeading}>Behavior over time</h2>
          <BehaviorCharts scores={scores} categories={categories} />
        </section>

        <section>
          <h2 style={sectionHeading}>Notes from the teacher</h2>
          {notes.length === 0 ? (
            <div style={{ ...cardStyle, color: "var(--ssd-text-muted)", fontSize: 14 }}>
              No notes shared yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    ...cardStyle,
                    fontSize: 14,
                    color: "var(--ssd-text)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {n.content}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

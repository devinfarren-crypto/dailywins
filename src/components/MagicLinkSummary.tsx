import type { ReactNode } from "react";

// Shared read-only behavior summary rendered by the parent / student / co-teacher
// magic-link pages. Pure presentational (no client hooks) so it renders inside a
// Server Component. Styled to the Sure Step Education design system.

export interface ScoreRow {
  id: string;
  period: number;
  scores: Record<string, unknown> | null;
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

function periodTotals(scores: ScoreRow[]): [number, number][] {
  const totals = new Map<number, number>();
  for (const row of scores) {
    if (!row || typeof row.period !== "number") continue;
    let sum = 0;
    const s = row.scores;
    if (s && typeof s === "object") {
      for (const v of Object.values(s)) {
        if (typeof v === "number" && Number.isFinite(v)) sum += v;
      }
    }
    totals.set(row.period, (totals.get(row.period) ?? 0) + sum);
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

export default function MagicLinkSummary({
  student,
  scores,
  notes,
  eyebrow = "· DailyWins ·",
  subtitle = "Behavior summary",
  banner,
}: {
  student: StudentRow;
  scores: ScoreRow[];
  notes: NoteRow[];
  eyebrow?: string;
  subtitle?: string;
  banner?: ReactNode;
}) {
  const periodRows = periodTotals(scores);
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
          <h2 style={sectionHeading}>By period</h2>
          {periodRows.length === 0 ? (
            <div style={{ ...cardStyle, color: "var(--ssd-text-muted)", fontSize: 14 }}>
              No scores yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {periodRows.map(([period, total]) => (
                <div
                  key={period}
                  style={{
                    ...cardStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 14, color: "var(--ssd-text)" }}>
                    <span style={{ color: "var(--ssd-text-muted)", marginRight: 8 }}>Period</span>
                    <span style={{ fontWeight: 600, color: "var(--ssd-ink)" }}>{period}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ssd-green-deep)" }}>{total}</div>
                </div>
              ))}
            </div>
          )}
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

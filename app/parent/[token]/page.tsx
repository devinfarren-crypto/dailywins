import { createClient } from "@supabase/supabase-js";

const COLORS = {
  primary: "#3a7c6a",
  dark: "#2a4d42",
  body: "#5a6e66",
  hint: "#8a9690",
  cream: "#faf7f0",
};

interface ScoreRow {
  id: string;
  period: number;
  scores: Record<string, unknown> | null;
}

interface NoteRow {
  id: string;
  content: string;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

interface ParentView {
  student: Student | null;
  scores: ScoreRow[];
  notes: NoteRow[];
}

function InvalidLinkCard() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: COLORS.cream,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 14,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          border: "1px solid #eee",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: COLORS.dark }}>
          This link is no longer valid
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: COLORS.body, lineHeight: 1.5 }}>
          It may have expired or been turned off. Ask your child&apos;s teacher for a new link.
        </p>
      </div>
    </main>
  );
}

export default async function ParentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return <InvalidLinkCard />;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("get_parent_view", { p_raw_token: token });

  if (error || !data) return <InvalidLinkCard />;

  const view = data as ParentView;
  const student = view.student;
  const scores: ScoreRow[] = Array.isArray(view.scores) ? view.scores : [];
  const notes: NoteRow[] = Array.isArray(view.notes) ? view.notes : [];

  if (!student) return <InvalidLinkCard />;

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
  const periodRows = [...totals.entries()].sort((a, b) => a[0] - b[0]);

  const fullName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Student";

  return (
    <main style={{ minHeight: "100vh", background: COLORS.cream, padding: "32px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ marginBottom: 28, textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.4,
              color: COLORS.primary,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            DailyWins
          </div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800, color: COLORS.dark }}>
            {fullName}
          </h1>
          <div style={{ fontSize: 14, color: COLORS.hint }}>Behavior summary</div>
        </header>

        <section style={{ marginBottom: 24 }}>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.dark,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            By period
          </h2>
          {periodRows.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 16,
                color: COLORS.hint,
                fontSize: 14,
              }}
            >
              No scores yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {periodRows.map(([period, total]) => (
                <div
                  key={period}
                  style={{
                    background: "white",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 14, color: COLORS.body }}>
                    <span style={{ color: COLORS.hint, marginRight: 8 }}>Period</span>
                    <span style={{ fontWeight: 700, color: COLORS.dark }}>{period}</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.primary }}>{total}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.dark,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Notes from the teacher
          </h2>
          {notes.length === 0 ? (
            <div
              style={{
                background: "white",
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 16,
                color: COLORS.hint,
                fontSize: 14,
              }}
            >
              No notes shared yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: "white",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 14,
                    color: COLORS.body,
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

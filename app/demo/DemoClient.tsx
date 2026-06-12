"use client";

// The live sandbox (dailywins.school/demo): a director's first hands-on
// contact with DailyWins. Everything here is the REAL product behavior —
// the tap-to-score grid with per-category point scales, arrival options,
// custom category labels, the actual BehaviorCharts component, and the
// actual printable record PDF — running on fictional students held in
// memory. No login, no database, nothing saved.

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BehaviorCharts, {
  type CategoryDef,
  type ChartScoreRow,
} from "@/src/components/BehaviorCharts";

const SCHOOL_NAMES: Record<string, string> = {
  "phillips-academy": "The Phillips Academy",
};

interface DemoCat extends CategoryDef {
  options?: string[];
}

const DEFAULT_CATS: DemoCat[] = [
  { id: "arrival", name: "Arrival", type: "arrival", maxPoints: 3, options: ["On time", "Tardy", "Absent"], pointValues: [3, 1, 0] },
  { id: "compliance", name: "Following directions", maxPoints: 3 },
  { id: "social", name: "Positive peer interactions", maxPoints: 3 },
  { id: "onTask", name: "On-task", maxPoints: 3 },
  { id: "phone", name: "Phone away", maxPoints: 1 },
];

const STUDENTS = [
  { id: "s1", name: "J. Alvarez", trend: 0.55 },
  { id: "s2", name: "M. Chen", trend: 0.7 },
  { id: "s3", name: "D. Okafor", trend: 0.45 },
  { id: "s4", name: "S. Rivera", trend: 0.8 },
  { id: "s5", name: "T. Williams", trend: 0.6 },
];

const PERIODS = [1, 2, 3, 4, 5, 6];

// today / per-student / per-period / per-category
type TodayState = Record<string, Record<number, Record<string, number | null>>>;

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Deterministic 8 weeks of believable history per student: school days only,
// three periods a day, a gentle upward trend with noise. Seeded so the demo
// is identical for every visitor — this is theater with honest math.
function buildHistory(): Record<string, ChartScoreRow[]> {
  const out: Record<string, ChartScoreRow[]> = {};
  let seed = 4242;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const today = new Date();
  for (const stu of STUDENTS) {
    const rows: ChartScoreRow[] = [];
    for (let daysAgo = 56; daysAgo >= 1; daysAgo--) {
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      // progress factor: starts near the student's base, climbs ~25 points
      const progress = stu.trend + (1 - daysAgo / 56) * 0.25;
      for (const period of [1, 2, 3]) {
        const scores: Record<string, number | null> = {};
        for (const cat of DEFAULT_CATS) {
          if (cat.type === "arrival") {
            const r = rnd();
            scores[cat.id] = r < progress ? 0 : r < progress + 0.18 ? 1 : 2; // option INDEX
          } else {
            const hit = rnd() < progress + 0.08;
            scores[cat.id] = hit
              ? cat.maxPoints
              : Math.max(0, Math.round(rnd() * (cat.maxPoints - 1)));
          }
        }
        rows.push({ id: `${stu.id}-${daysAgo}-${period}`, score_date: localISO(d), period, scores });
      }
    }
    out[stu.id] = rows;
  }
  return out;
}

export default function DemoClient() {
  const params = useSearchParams();
  const schoolName = SCHOOL_NAMES[params.get("school") ?? ""] ?? "Your School";
  const backTo = SCHOOL_NAMES[params.get("school") ?? ""] ? `/for/${params.get("school")}` : null;

  const [cats, setCats] = useState<DemoCat[]>(DEFAULT_CATS);
  const [period, setPeriod] = useState(3);
  const [today, setToday] = useState<TodayState>({});
  const [chartStudent, setChartStudent] = useState("s1");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [taps, setTaps] = useState(0);

  const history = useMemo(buildHistory, []);
  const todayISO = localISO(new Date());

  const getCell = (sid: string, cat: DemoCat): number | null =>
    today[sid]?.[period]?.[cat.id] ?? null;

  const setCell = (sid: string, catId: string, value: number | null) => {
    setToday((prev) => ({
      ...prev,
      [sid]: { ...prev[sid], [period]: { ...prev[sid]?.[period], [catId]: value } },
    }));
    setTaps((t) => t + 1);
  };

  // The real grid behavior: arrival cycles its options (stores the option
  // index); point categories cycle blank → 1 → … → max → blank.
  const tapCell = (sid: string, cat: DemoCat) => {
    const cur = getCell(sid, cat);
    if (cat.type === "arrival") {
      const count = cat.options?.length ?? 3;
      setCell(sid, cat.id, cur === null ? 0 : cur + 1 >= count ? null : cur + 1);
    } else {
      setCell(sid, cat.id, cur === null ? cat.maxPoints : cur - 1 < 0 ? null : cur - 1 === 0 ? null : cur - 1);
    }
  };

  const fillRow = (sid: string) => {
    for (const cat of cats) setCell(sid, cat.id, cat.type === "arrival" ? 0 : cat.maxPoints);
  };
  const fillAll = () => STUDENTS.forEach((s) => fillRow(s.id));

  // Merge seeded history + this session's taps for the chart + PDF.
  const rowsFor = (sid: string): ChartScoreRow[] => {
    const live: ChartScoreRow[] = [];
    const byPeriod = today[sid] ?? {};
    for (const [p, scores] of Object.entries(byPeriod)) {
      if (Object.values(scores).some((v) => v !== null)) {
        live.push({ id: `${sid}-today-${p}`, score_date: todayISO, period: Number(p), scores });
      }
    }
    return [...history[sid], ...live];
  };

  const printPdf = async () => {
    setPdfBusy(true);
    try {
      const { generateStudentRecordPdf } = await import("@/src/lib/student-record-pdf");
      const stu = STUDENTS.find((s) => s.id === chartStudent)!;
      await generateStudentRecordPdf({
        studentName: `${stu.name} (fictional)`,
        schoolName: `${schoolName} — DailyWins sandbox`,
        generatedBy: "the live demo at dailywins.school/demo",
        scores: rowsFor(stu.id),
        categories: cats,
        notes: [
          {
            note_date: todayISO,
            period: "3",
            content:
              "Responded well to the new seating arrangement — initiated group work without prompting. Continuing the morning check-in strategy.",
            is_private: false,
            teacher_name: "Demo Teacher",
          },
          {
            note_date: todayISO,
            period: "5",
            content:
              "Family meeting scheduled for next week; coordinate with counseling before discussing schedule changes. (Private notes stay off family links.)",
            is_private: true,
            teacher_name: "Demo Teacher",
          },
        ],
      });
    } finally {
      setPdfBusy(false);
    }
  };

  const updateCat = (id: string, patch: Partial<DemoCat>) =>
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCat = (id: string) => setCats((prev) => (prev.length > 1 ? prev.filter((c) => c.id !== id) : prev));
  const addCat = () =>
    setCats((prev) =>
      prev.length >= 8
        ? prev
        : [...prev, { id: `custom${prev.length}-${Date.now() % 1000}`, name: "New IEP goal", maxPoints: 3 }]
    );

  const cellLabel = (cat: DemoCat, v: number | null): string => {
    if (v === null) return "·";
    if (cat.type === "arrival") return (cat.options?.[v] ?? "?").slice(0, 1).toUpperCase();
    return String(v);
  };
  const cellOn = (cat: DemoCat, v: number | null): boolean =>
    v !== null && (cat.type === "arrival" ? v === 0 : v === cat.maxPoints);
  const cellMid = (cat: DemoCat, v: number | null): boolean =>
    v !== null && !cellOn(cat, v);

  const chartRows = useMemo(
    () => rowsFor(chartStudent),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartStudent, today, history]
  );

  return (
    <main style={{ minHeight: "100vh", background: "var(--ssd-paper, #F7F5F0)", fontFamily: "var(--ssd-font-body, 'DM Sans', system-ui, sans-serif)", color: "var(--ssd-ink, #1a1a2e)" }}>
      {/* sandbox banner */}
      <div style={{ background: "var(--ssd-green-deep, #0F6E56)", color: "#fff", textAlign: "center", padding: "9px 16px", fontSize: 13.5, fontWeight: 600 }}>
        Live sandbox — fictional students, nothing saves to a server. This is the real interface your teachers would use.
      </div>

      {/* header */}
      <div style={{ background: "var(--ssd-navy, #1a1a2e)", color: "#fff", padding: "26px 0 22px" }}>
        <div style={wrap}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--ssd-font-display, 'DM Serif Display', Georgia, serif)", fontSize: 26 }}>
                DailyWins <span style={{ color: "var(--ssd-teal-light, #5DCAA5)" }}>sandbox</span>
              </div>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.65)", marginTop: 2 }}>
                Prepared for {schoolName} · tap cells the way a teacher would between classes
              </div>
            </div>
            <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, letterSpacing: ".08em", color: "var(--ssd-teal-light, #5DCAA5)" }}>
              {taps === 0 ? "⏱ your first tap starts the clock" : `⏱ ${taps} taps so far`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...wrap, paddingTop: 26, paddingBottom: 70 }}>
        {/* period tabs + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  ...chip,
                  background: p === period ? "var(--ssd-green, #1D9E75)" : "var(--ssd-surface, #fff)",
                  color: p === period ? "#fff" : "var(--ssd-ink, #1a1a2e)",
                  borderColor: p === period ? "var(--ssd-green, #1D9E75)" : "var(--ssd-border, #d9d4c5)",
                }}
              >
                Period {p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setCustomizeOpen((v) => !v)} style={{ ...chip, background: customizeOpen ? "var(--ssd-ink, #1a1a2e)" : "var(--ssd-surface, #fff)", color: customizeOpen ? "#fff" : "var(--ssd-ink, #1a1a2e)" }}>
              🎨 Customize goals
            </button>
            <button onClick={fillAll} style={{ ...chip, background: "var(--ssd-surface, #fff)" }}>⚡ Fill the period</button>
          </div>
        </div>

        {/* customize drawer — the part no mock can show */}
        {customizeOpen ? (
          <div style={{ ...card, marginBottom: 16, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Your goals, your language</div>
            <p style={{ fontSize: 13.5, color: "var(--ssd-text-muted, #6b6e69)", margin: "0 0 14px" }}>
              Rename any goal to match the exact wording in a student&apos;s IEP, set its point scale, add your own.
              Watch the grid, charts, and printed report follow instantly.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cats.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={c.name}
                    onChange={(e) => updateCat(c.id, { name: e.target.value.slice(0, 40) })}
                    style={{ flex: 1, minWidth: 200, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--ssd-border, #d9d4c5)", fontSize: 14, fontFamily: "inherit" }}
                  />
                  {c.type === "arrival" ? (
                    <span style={{ fontSize: 12.5, color: "var(--ssd-text-muted, #6b6e69)" }}>
                      options: {c.options?.join(" / ")}
                    </span>
                  ) : (
                    <label style={{ fontSize: 12.5, color: "var(--ssd-text-muted, #6b6e69)" }}>
                      max&nbsp;
                      <select
                        value={c.maxPoints}
                        onChange={(e) => updateCat(c.id, { maxPoints: Number(e.target.value) })}
                        style={{ padding: "7px 8px", borderRadius: 8, border: "1px solid var(--ssd-border, #d9d4c5)", fontSize: 13 }}
                      >
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} pts</option>)}
                      </select>
                    </label>
                  )}
                  {cats.length > 1 ? (
                    <button onClick={() => removeCat(c.id)} aria-label={`Remove ${c.name}`} style={{ ...chip, padding: "7px 12px", color: "#9c3a22" }}>
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {cats.length < 8 ? (
              <button onClick={addCat} style={{ ...chip, marginTop: 12, background: "var(--ssd-green, #1D9E75)", color: "#fff", borderColor: "var(--ssd-green, #1D9E75)" }}>
                + Add a goal
              </button>
            ) : null}
          </div>
        ) : null}

        {/* the grid */}
        <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 30 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left", paddingLeft: 18 }}>Student</th>
                  {cats.map((c) => (
                    <th key={c.id} style={th} title={c.type === "arrival" ? `Tap cycles: ${c.options?.join(" → ")}` : `Tap cycles 0–${c.maxPoints} points`}>
                      {c.name}
                      <span style={{ display: "block", fontSize: 9, color: "var(--ssd-text-muted, #9a9a8e)", letterSpacing: ".04em" }}>
                        {c.type === "arrival" ? (c.options ?? []).map((o) => o[0]).join("/") : `0–${c.maxPoints} pts`}
                      </span>
                    </th>
                  ))}
                  <th style={{ ...th, cursor: "pointer", color: "var(--ssd-green-deep, #0F6E56)" }} onClick={fillAll} title="Quick-fill every goal for every student">
                    ⚡ All
                  </th>
                </tr>
              </thead>
              <tbody>
                {STUDENTS.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "11px 12px 11px 18px", borderBottom: "1px solid var(--ssd-border-soft, #ebe7da)", fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap" }}>
                      {s.name}
                    </td>
                    {cats.map((c) => {
                      const v = getCell(s.id, c);
                      return (
                        <td key={c.id} style={td}>
                          <button
                            onClick={() => tapCell(s.id, c)}
                            aria-label={`${s.name} — ${c.name}`}
                            style={{
                              width: 40, height: 40, borderRadius: 10, cursor: "pointer",
                              fontSize: 15, fontWeight: 700, lineHeight: 1,
                              border: `1.5px solid ${cellOn(c, v) ? "var(--ssd-green, #1D9E75)" : cellMid(c, v) ? "var(--ssd-amber, #EF9F27)" : "var(--ssd-border, #d9d4c5)"}`,
                              background: cellOn(c, v) ? "var(--ssd-mist, #E1F5EE)" : cellMid(c, v) ? "#FFF1D6" : "var(--ssd-paper, #F7F5F0)",
                              color: cellOn(c, v) ? "var(--ssd-green-deep, #0F6E56)" : cellMid(c, v) ? "#8a6310" : "var(--ssd-text-muted, #9a9a8e)",
                              transition: "background .12s, border-color .12s",
                            }}
                          >
                            {cellLabel(c, v)}
                          </button>
                        </td>
                      );
                    })}
                    <td style={td}>
                      <button onClick={() => fillRow(s.id)} title={`Quick-fill ${s.name}`} style={{ width: 40, height: 40, borderRadius: 10, cursor: "pointer", border: "1.5px solid var(--ssd-border, #d9d4c5)", background: "var(--ssd-paper, #F7F5F0)", fontSize: 15 }}>
                        ⚡
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ padding: "12px 18px 16px", margin: 0, fontSize: 13, color: "var(--ssd-text-muted, #6b6e69)" }}>
            Arrival taps cycle the real options (On time → Tardy → Absent); point goals cycle their scale.
            In the classroom this is the whole job — the record below builds itself.
          </p>
        </div>

        {/* charts — the actual product component */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontFamily: "var(--ssd-font-display, 'DM Serif Display', Georgia, serif)", fontWeight: 400, fontSize: 28, margin: 0 }}>
            Where the taps go
          </h2>
          <span style={{ fontSize: 13, color: "var(--ssd-text-muted, #6b6e69)" }}>
            8 weeks of (fictional) history + everything you just tapped
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {STUDENTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setChartStudent(s.id)}
              style={{
                ...chip,
                background: s.id === chartStudent ? "var(--ssd-ink, #1a1a2e)" : "var(--ssd-surface, #fff)",
                color: s.id === chartStudent ? "#fff" : "var(--ssd-ink, #1a1a2e)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div style={{ ...card, padding: "18px 20px", marginBottom: 26 }}>
          <BehaviorCharts scores={chartRows} categories={cats} />
        </div>

        {/* the artifact */}
        <div style={{ ...card, padding: "26px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", background: "var(--ssd-navy, #1a1a2e)", border: "none" }}>
          <div style={{ color: "#fff", maxWidth: 520 }}>
            <div style={{ fontFamily: "var(--ssd-font-display, 'DM Serif Display', Georgia, serif)", fontSize: 24, marginBottom: 6 }}>
              Now hold the meeting artifact.
            </div>
            <p style={{ margin: 0, fontSize: 14.5, color: "rgba(255,255,255,.75)" }}>
              One click prints {STUDENTS.find((s) => s.id === chartStudent)?.name}&apos;s real progress report —
              weekly and monthly charts, your goal language, copier-safe. The exact PDF a teacher hands across
              the IEP table.
            </p>
          </div>
          <button
            onClick={printPdf}
            disabled={pdfBusy}
            style={{ padding: "15px 28px", borderRadius: 999, border: "none", background: "var(--ssd-teal-light, #5DCAA5)", color: "#0e2a20", fontWeight: 700, fontSize: 15.5, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {pdfBusy ? "Building…" : "Print the IEP progress report ↓"}
          </button>
        </div>

        {/* close */}
        <div style={{ textAlign: "center", marginTop: 44 }}>
          <p style={{ fontSize: 15.5, color: "var(--ssd-text-muted, #4a4a5e)", maxWidth: "62ch", margin: "0 auto 18px" }}>
            Everything you just did — custom goals, point scales, charts, the printed report — is the shipping
            product. The free 60-day pilot adds your real roster, your bell schedule, and your staff.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href={`mailto:support@surestepeducation.com?subject=${encodeURIComponent(`${schoolName} pilot — let's do it`)}&body=${encodeURIComponent("Hi Devin — let's set up the free 60-day pilot.\n\nBest day/time for a 15-minute walkthrough: ")}`}
              style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, background: "var(--ssd-green, #1D9E75)", color: "#fff", fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}
            >
              Start the free pilot
            </a>
            {backTo ? (
              <a href={backTo} style={{ display: "inline-block", padding: "14px 28px", borderRadius: 999, border: "1.5px solid var(--ssd-ink, #1a1a2e)", color: "var(--ssd-ink, #1a1a2e)", fontWeight: 700, fontSize: 15.5, textDecoration: "none" }}>
                ← Back to your page
              </a>
            ) : null}
          </div>
          <p style={{ fontSize: 12, color: "var(--ssd-text-muted, #9a9a8e)", marginTop: 22 }}>
            Students on this page are fictional. © Sure Step Education · <a href="/privacy" style={{ color: "inherit" }}>Privacy</a>
          </p>
        </div>
      </div>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 1060, margin: "0 auto", padding: "0 20px" };
const card: React.CSSProperties = {
  background: "var(--ssd-surface, #fff)",
  border: "1px solid var(--ssd-border, #d9d4c5)",
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(26,38,61,.05)",
};
const chip: React.CSSProperties = {
  padding: "9px 16px",
  borderRadius: 999,
  border: "1px solid var(--ssd-border, #d9d4c5)",
  background: "var(--ssd-surface, #fff)",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
const th: React.CSSProperties = {
  padding: "12px 8px",
  fontSize: 11,
  letterSpacing: ".07em",
  textTransform: "uppercase",
  color: "var(--ssd-text-muted, #6b6e69)",
  borderBottom: "1px solid var(--ssd-border, #d9d4c5)",
  fontWeight: 600,
  textAlign: "center",
  background: "var(--ssd-surface, #fff)",
};
const td: React.CSSProperties = {
  padding: "8px 6px",
  textAlign: "center",
  borderBottom: "1px solid var(--ssd-border-soft, #ebe7da)",
};

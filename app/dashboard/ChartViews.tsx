"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from "recharts";

// ─── Types (must match dashboard page) ──────────────────────────────────────

interface Category {
  id: string;
  name: string;
  type: "arrival" | "scale" | "toggle";
  options: string[];
  pointValues: number[];
  maxPoints: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

interface DbNoteRow {
  note_date: string;
  content: string;
  period: string | null;
  is_private: boolean;
  created_at: string;
}

interface DbScoreRow {
  score_date: string;
  period: number;
  scores: Record<string, number | null> | null;
  // Legacy columns
  arrival?: number | null;
  compliance?: number | null;
  social?: number | null;
  on_task?: number | null;
  phone_away?: boolean | null;
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  primary: "#e07850",
  secondary: "#3a7c6a",
  accent: "#f0b647",
  dark: "#2c3e50",
  blue: "#3498db",
};

const CHART_COLORS = [
  "#3a7c6a", // secondary/green
  "#3498db", // blue
  "#f0b647", // accent/gold
  "#e07850", // primary/coral
  "#9b59b6", // purple
  "#1abc9c", // teal
  "#e74c3c", // red
  "#f39c12", // orange
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diff);
  return mon;
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function shortMonth(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m];
}

function extractScores(row: DbScoreRow, categories: Category[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (row.scores) {
    for (const cat of categories) {
      result[cat.id] = row.scores[cat.id] ?? 0;
    }
  } else {
    // Legacy fallback
    for (const cat of categories) {
      if (cat.id === "arrival") result[cat.id] = row.arrival ?? 0;
      else if (cat.id === "compliance") result[cat.id] = row.compliance ?? 0;
      else if (cat.id === "social") result[cat.id] = row.social ?? 0;
      else if (cat.id === "onTask") result[cat.id] = row.on_task ?? 0;
      else if (cat.id === "phoneAway") result[cat.id] = row.phone_away ? cat.maxPoints : 0;
      else result[cat.id] = 0;
    }
  }
  return result;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChartViewsProps {
  view: "weekly" | "monthly" | "annual";
  supabase: SupabaseClient;
  studentId: string;
  studentName: string;
  teacherId: string;
  selectedDate: string;
  categories: Category[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChartViews({
  view,
  supabase,
  studentId,
  studentName,
  teacherId,
  selectedDate,
  categories,
}: ChartViewsProps) {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<DbScoreRow[]>([]);
  const [noteData, setNoteData] = useState<DbNoteRow[]>([]);

  // Compute date range based on view
  const { startDate, endDate, rangeLabel } = useMemo(() => {
    if (view === "weekly") {
      const mon = getMonday(selectedDate);
      const fri = new Date(mon);
      fri.setDate(mon.getDate() + 4);
      return {
        startDate: formatDate(mon),
        endDate: formatDate(fri),
        rangeLabel: `Week of ${formatDate(mon)} to ${formatDate(fri)}`,
      };
    }
    if (view === "monthly") {
      const d = new Date(selectedDate + "T12:00:00");
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return {
        startDate: formatDate(first),
        endDate: formatDate(last),
        rangeLabel: `${shortMonth(d.getMonth())} ${d.getFullYear()}`,
      };
    }
    // Annual: school year Aug–Jun
    const d = new Date(selectedDate + "T12:00:00");
    const year = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return {
      startDate: `${year}-08-01`,
      endDate: `${year + 1}-06-30`,
      rangeLabel: `School Year ${year}–${year + 1}`,
    };
  }, [view, selectedDate]);

  // Fetch data
  useEffect(() => {
    if (!studentId || !teacherId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("behavior_scores")
        .select("score_date,period,scores,arrival,compliance,social,on_task,phone_away")
        .eq("student_id", studentId)
        .eq("teacher_id", teacherId)
        .gte("score_date", startDate)
        .lte("score_date", endDate)
        .order("score_date", { ascending: true }),
      supabase
        .from("notes")
        .select("note_date,content,period,is_private,created_at")
        .eq("student_id", studentId)
        .gte("note_date", startDate)
        .lte("note_date", endDate)
        .order("created_at", { ascending: true }),
    ]).then(([scoresResult, notesResult]: [{ data: DbScoreRow[] | null; error: unknown }, { data: DbNoteRow[] | null; error: unknown }]) => {
      if (scoresResult.error) console.error("Chart data fetch error:", scoresResult.error);
      setRawData(scoresResult.data ?? []);
      setNoteData(notesResult.data ?? []);
      setLoading(false);
    });
  }, [supabase, studentId, teacherId, startDate, endDate]);

  const maxPerPeriod = categories.reduce((s, c) => s + c.maxPoints, 0);

  if (loading) {
    return (
      <div style={{ background: "white", borderRadius: 14, padding: 40, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ color: "#999", fontSize: 14 }}>Loading chart data...</div>
      </div>
    );
  }

  if (rawData.length === 0) {
    return (
      <div style={{ background: "white", borderRadius: 14, padding: 40, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#128202;</div>
        <div style={{ color: COLORS.dark, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>No Data Yet</div>
        <div style={{ color: "#999", fontSize: 13 }}>No behavior scores found for {rangeLabel}.</div>
      </div>
    );
  }

  if (view === "weekly") return <WeeklyChart data={rawData} notes={noteData} categories={categories} studentName={studentName} rangeLabel={rangeLabel} maxPerPeriod={maxPerPeriod} />;
  if (view === "monthly") return <MonthlyChart data={rawData} notes={noteData} categories={categories} studentName={studentName} rangeLabel={rangeLabel} maxPerPeriod={maxPerPeriod} />;
  return <AnnualChart data={rawData} categories={categories} studentName={studentName} rangeLabel={rangeLabel} maxPerPeriod={maxPerPeriod} />;
}

// ─── Weekly Chart ────────────────────────────────────────────────────────────

function WeeklyChart({ data, notes, categories, studentName, rangeLabel, maxPerPeriod }: {
  data: DbScoreRow[];
  notes: DbNoteRow[];
  categories: Category[];
  studentName: string;
  rangeLabel: string;
  maxPerPeriod: number;
}) {
  // Aggregate per day: sum each category across all periods
  const byDay = new Map<string, Record<string, number>>();
  for (const row of data) {
    const s = extractScores(row, categories);
    const existing = byDay.get(row.score_date);
    if (existing) {
      for (const cat of categories) {
        existing[cat.id] = (existing[cat.id] ?? 0) + (s[cat.id] ?? 0);
      }
      existing._count = (existing._count ?? 0) + 1;
    } else {
      const entry: Record<string, number> = { _count: 1 };
      for (const cat of categories) {
        entry[cat.id] = s[cat.id] ?? 0;
      }
      byDay.set(row.score_date, entry);
    }
  }

  const chartData = Array.from(byDay.entries()).map(([date, vals]) => ({
    day: shortDay(date),
    date,
    ...vals,
  }));

  // Max Y: estimate max periods per day * maxPerPeriod
  const periodsPerDay = Math.max(...Array.from(byDay.values()).map((v) => v._count ?? 1), 1);
  const maxY = periodsPerDay * maxPerPeriod;

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <ChartHeader title="Weekly Overview" subtitle={`${studentName} — ${rangeLabel}`} />
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="day" tick={{ fill: COLORS.dark, fontSize: 12, fontWeight: 600 }} />
          <YAxis domain={[0, maxY]} tick={{ fill: "#999", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", fontSize: 13 }}
            formatter={(value, name) => [String(value), String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {categories.map((cat, i) => (
            <Bar
              key={cat.id}
              dataKey={cat.id}
              name={cat.name}
              stackId="a"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {/* Daily totals below */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
        {chartData.map((d) => {
          const dAny = d as Record<string, unknown>;
          const total = categories.reduce((sum, cat) => sum + ((dAny[cat.id] as number) ?? 0), 0);
          const pct = maxY > 0 ? Math.round((total / maxY) * 100) : 0;
          return (
            <div key={d.date} style={{ textAlign: "center", minWidth: 70 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#999", textTransform: "uppercase" }}>{d.day}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark }}>{total}</div>
              <div style={{ fontSize: 11, color: pct >= 80 ? COLORS.secondary : pct >= 50 ? COLORS.accent : COLORS.primary, fontWeight: 700 }}>{pct}%</div>
            </div>
          );
        })}
      </div>
      {/* Notes summary per day */}
      {notes.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {chartData.map((d) => {
            const dayNotes = notes.filter((n) => n.note_date === d.date && !n.is_private);
            if (dayNotes.length === 0) return null;
            return (
              <div key={d.date} style={{ background: "#fafaf7", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.dark, marginBottom: 4 }}>{d.day} &mdash; {d.date}</div>
                {dayNotes.map((n, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#555", lineHeight: 1.4, marginBottom: 2 }}>
                    <span style={{ fontWeight: 700, color: COLORS.secondary }}>{n.period ? n.period : "General"}:</span>{" "}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block", maxWidth: "80%", verticalAlign: "bottom" }}>
                      &ldquo;{n.content}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Monthly Chart ───────────────────────────────────────────────────────────

function MonthlyChart({ data, notes, categories, studentName, rangeLabel, maxPerPeriod }: {
  data: DbScoreRow[];
  notes: DbNoteRow[];
  categories: Category[];
  studentName: string;
  rangeLabel: string;
  maxPerPeriod: number;
}) {
  // Collect dates that have notes
  const datesWithNotes = new Set(notes.map((n) => n.note_date));
  // Aggregate per day: total points and per-category
  const byDay = new Map<string, { total: number; count: number; cats: Record<string, number> }>();
  for (const row of data) {
    const s = extractScores(row, categories);
    const total = categories.reduce((sum, cat) => sum + (s[cat.id] ?? 0), 0);
    const existing = byDay.get(row.score_date);
    if (existing) {
      existing.total += total;
      existing.count += 1;
      for (const cat of categories) {
        existing.cats[cat.id] = (existing.cats[cat.id] ?? 0) + (s[cat.id] ?? 0);
      }
    } else {
      const cats: Record<string, number> = {};
      for (const cat of categories) cats[cat.id] = s[cat.id] ?? 0;
      byDay.set(row.score_date, { total, count: 1, cats });
    }
  }

  const chartData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => {
      const d = new Date(date + "T12:00:00");
      return {
        day: d.getDate(),
        date,
        total: vals.total,
        periods: vals.count,
        ...vals.cats,
      };
    });

  const maxPeriods = Math.max(...chartData.map((d) => d.periods), 1);
  const maxY = maxPeriods * maxPerPeriod;

  // Category averages for the month
  const totals: Record<string, number> = {};
  let totalPeriods = 0;
  for (const vals of byDay.values()) {
    totalPeriods += vals.count;
    for (const cat of categories) {
      totals[cat.id] = (totals[cat.id] ?? 0) + vals.cats[cat.id];
    }
  }
  const daysActive = byDay.size;

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <ChartHeader title="Monthly Overview" subtitle={`${studentName} — ${rangeLabel}`} />
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="day" tick={{ fill: COLORS.dark, fontSize: 11, fontWeight: 600 }} />
          <YAxis domain={[0, maxY]} tick={{ fill: "#999", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", fontSize: 13 }}
            labelFormatter={(label) => `Day ${label}`}
            formatter={(value, name) => [String(value), String(name)]}
          />
          <Bar dataKey="total" name="Daily Total" fill={COLORS.secondary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Note indicators per day */}
      {datesWithNotes.size > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#999", lineHeight: "20px" }}>&#128221; Notes:</span>
          {chartData.filter((d) => datesWithNotes.has(d.date)).map((d) => (
            <span key={d.date} style={{ fontSize: 10, fontWeight: 700, color: COLORS.secondary, background: "#e8f5f0", borderRadius: 6, padding: "2px 8px" }}>
              {d.day}
            </span>
          ))}
        </div>
      )}

      {/* Category averages table */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          Monthly Averages ({daysActive} days tracked)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(categories.length, 5)}, 1fr)`, gap: 10 }}>
          {categories.map((cat, i) => {
            const avg = totalPeriods > 0 ? (totals[cat.id] ?? 0) / totalPeriods : 0;
            const pct = cat.maxPoints > 0 ? Math.round((avg / cat.maxPoints) * 100) : 0;
            return (
              <div key={cat.id} style={{
                background: "#f8f8f5",
                borderRadius: 10,
                padding: "12px 14px",
                borderLeft: `4px solid ${CHART_COLORS[i % CHART_COLORS.length]}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#999", marginBottom: 4 }}>{cat.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.dark }}>{avg.toFixed(1)}</div>
                <div style={{ fontSize: 11, color: pct >= 80 ? COLORS.secondary : pct >= 50 ? COLORS.accent : COLORS.primary, fontWeight: 700 }}>
                  {pct}% of max
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Annual Chart ────────────────────────────────────────────────────────────

function AnnualChart({ data, categories, studentName, rangeLabel, maxPerPeriod }: {
  data: DbScoreRow[];
  categories: Category[];
  studentName: string;
  rangeLabel: string;
  maxPerPeriod: number;
}) {
  // Aggregate by month
  const byMonth = new Map<string, { total: number; count: number; cats: Record<string, number> }>();
  for (const row of data) {
    const monthKey = row.score_date.substring(0, 7); // "YYYY-MM"
    const s = extractScores(row, categories);
    const total = categories.reduce((sum, cat) => sum + (s[cat.id] ?? 0), 0);
    const existing = byMonth.get(monthKey);
    if (existing) {
      existing.total += total;
      existing.count += 1;
      for (const cat of categories) {
        existing.cats[cat.id] = (existing.cats[cat.id] ?? 0) + (s[cat.id] ?? 0);
      }
    } else {
      const cats: Record<string, number> = {};
      for (const cat of categories) cats[cat.id] = s[cat.id] ?? 0;
      byMonth.set(monthKey, { total, count: 1, cats });
    }
  }

  // School year order: Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun
  const monthOrder = [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5]; // JS month indices

  const chartData = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, vals]) => {
      const [y, m] = monthKey.split("-").map(Number);
      const avgTotal = vals.count > 0 ? Math.round((vals.total / vals.count) * 10) / 10 : 0;
      const avgPct = vals.count > 0 && maxPerPeriod > 0 ? Math.round((vals.total / vals.count / maxPerPeriod) * 100) : 0;
      const catAvgs: Record<string, number> = {};
      for (const cat of categories) {
        catAvgs[cat.id] = vals.count > 0 ? Math.round(((vals.cats[cat.id] ?? 0) / vals.count) * 10) / 10 : 0;
      }
      return {
        month: shortMonth(m - 1),
        monthKey,
        avgTotal,
        avgPct,
        periods: vals.count,
        ...catAvgs,
      };
    });

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <ChartHeader title="Annual Overview" subtitle={`${studentName} — ${rangeLabel}`} />
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="month" tick={{ fill: COLORS.dark, fontSize: 12, fontWeight: 600 }} />
          <YAxis yAxisId="pts" tick={{ fill: "#999", fontSize: 11 }} />
          <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fill: "#999", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", fontSize: 13 }}
            formatter={(value, name) => {
              if (name === "Avg %") return [`${value}%`, String(name)];
              return [String(value), String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {categories.map((cat, i) => (
            <Bar
              key={cat.id}
              yAxisId="pts"
              dataKey={cat.id}
              name={cat.name}
              stackId="a"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="avgPct"
            name="Avg %"
            stroke={COLORS.dark}
            strokeWidth={3}
            dot={{ r: 5, fill: COLORS.dark }}
            activeDot={{ r: 7 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Monthly summary cards */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
        {chartData.map((d) => (
          <div key={d.monthKey} style={{
            minWidth: 80,
            background: "#f8f8f5",
            borderRadius: 10,
            padding: "10px 12px",
            textAlign: "center",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#999" }}>{d.month}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.dark }}>{d.avgPct}%</div>
            <div style={{ fontSize: 10, color: "#999" }}>{d.periods} periods</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared Header ───────────────────────────────────────────────────────────

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.dark }}>{title}</h3>
      <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{subtitle}</div>
    </div>
  );
}

"use client";

// Parent / student / co-teacher behavior charts (replaces the old cumulative
// "By period" numbers). A Daily / Weekly / Monthly toggle drives:
//   1. an overall %-of-goals-met bar chart over time (color-graded), and
//   2. a per-category breakdown — labeled with the TEACHER'S OWN category names,
//      so custom labels (Empathy / Organization / Timeliness …) flow straight
//      through from teachers.categories with correct colors and max points.
//
// Recharts lives in BehaviorOverTimeChart and is pulled in only via a dynamic
// ssr:false import (CLAUDE.md gotcha). The per-category bars are plain CSS, so
// they render fine during SSR.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { TimeBucket } from "@/src/components/BehaviorOverTimeChart";

const BehaviorOverTimeChart = dynamic(
  () => import("@/src/components/BehaviorOverTimeChart"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ssd-text-muted)",
          fontSize: 13,
        }}
      >
        Loading chart…
      </div>
    ),
  }
);

// The teacher's category config, as stored in teachers.categories. We only need
// these fields; the dashboard stores more (type/options/pointValues).
export interface CategoryDef {
  id: string;
  name: string;
  maxPoints: number;
  noPoints?: boolean;
  // Needed to score "arrival"-type categories correctly: they store an option
  // INDEX (pointValues can collide, e.g. [3,0,3]), not the point value.
  type?: string;
  pointValues?: number[];
  options?: string[];
}

// One behavior_scores row as returned by the magic-link RPCs (migration 038).
export interface ChartScoreRow {
  id: string;
  score_date: string; // YYYY-MM-DD
  period: number;
  scores: Record<string, number | null> | null;
  // Legacy per-category columns (pre-jsonb rows)
  arrival?: number | null;
  compliance?: number | null;
  social?: number | null;
  on_task?: number | null;
  phone_away?: boolean | null;
}

export type Grain = "daily" | "weekly" | "monthly";

// Fallback when a student has no scores yet (RPC returns []). Mirrors the
// teachers.categories DB default (see DashboardClient DEFAULT_CATEGORIES).
const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: "arrival", name: "Arrival", type: "arrival", pointValues: [3, 0, 3], maxPoints: 3 },
  { id: "compliance", name: "Compliance", maxPoints: 3 },
  { id: "social", name: "Social", maxPoints: 3 },
  { id: "onTask", name: "On-Task", maxPoints: 3 },
  { id: "homework", name: "Homework", maxPoints: 1, noPoints: true },
];

// Per-category bar colors (matches ChartViews CHART_COLORS ordering).
const CHART_COLORS = [
  "#3a7c6a",
  "#3498db",
  "#f0b647",
  "#e07850",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#f39c12",
];

const CAP: Record<Grain, number> = { daily: 14, weekly: 10, monthly: 12 };
const GRAIN_NOUN: Record<Grain, string> = { daily: "days", weekly: "weeks", monthly: "months" };
const SHORT_MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// An "arrival" category stores the OPTION INDEX (its pointValues can collide,
// e.g. [3,0,3]), not the point value; every other type stores points directly.
// Mirrors the dashboard's calculatePeriodPoints so the % is correct.
//
// Stored teacher configs often have NO pointValues (the teachers.categories DB
// default from migration 003 ships options only) — derive them exactly like
// the dashboard's ensurePointValues, or every arrival charts as 0 (the
// "Arrival 0%" bug seen on the records view 2026-06-11).
function arrivalPointValues(cat: CategoryDef): number[] {
  if (cat.pointValues && cat.pointValues.length > 0) return cat.pointValues;
  const maxPts = cat.maxPoints ?? 3;
  const optCount = cat.options?.length ?? 3;
  // On Time / L / L-E: excused late = full points (matches the dashboard).
  return optCount === 3
    ? [maxPts, 0, maxPts]
    : Array.from({ length: optCount }, (_, i) => Math.max(0, maxPts - i));
}

function pointsForRaw(cat: CategoryDef, raw: number): number {
  if (cat.type === "arrival") return arrivalPointValues(cat)[raw] ?? 0;
  return raw;
}

// Per-row category points. Mirrors ChartViews.extractScores incl. legacy fallback.
function extractScores(row: ChartScoreRow, categories: CategoryDef[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (row.scores) {
    for (const cat of categories) result[cat.id] = pointsForRaw(cat, num(row.scores[cat.id]));
  } else {
    for (const cat of categories) {
      if (cat.id === "arrival") result[cat.id] = pointsForRaw(cat, num(row.arrival));
      else if (cat.id === "compliance") result[cat.id] = row.compliance ?? 0;
      else if (cat.id === "social") result[cat.id] = row.social ?? 0;
      else if (cat.id === "onTask") result[cat.id] = row.on_task ?? 0;
      else if (cat.id === "phoneAway") result[cat.id] = row.phone_away ? cat.maxPoints : 0;
      else result[cat.id] = 0;
    }
  }
  return result;
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Sunday → previous Monday
  d.setDate(d.getDate() + diff);
  return d;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mdLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function bucketFor(grain: Grain, scoreDate: string): { key: string; label: string } {
  if (grain === "daily") return { key: scoreDate, label: mdLabel(scoreDate) };
  if (grain === "weekly") {
    const monday = ymd(getMonday(scoreDate));
    return { key: monday, label: mdLabel(monday) };
  }
  const key = scoreDate.slice(0, 7); // YYYY-MM
  return { key, label: SHORT_MONTH[Number(key.slice(5, 7)) - 1] ?? key };
}

interface Bucket {
  key: string;
  label: string;
  count: number; // period-entries
  earned: number;
  possible: number;
  perCat: Record<string, number>;
}

export interface GrainSummary {
  series: TimeBucket[];
  breakdown: { id: string; name: string; pct: number; color: string }[];
  totalCount: number;
}

// The single source of the chart math — used by the component below AND the
// director's printable PDF (src/lib/student-record-pdf.ts), so what prints is
// exactly what's on screen.
export function summarizeBehavior(
  scores: ChartScoreRow[],
  categories: CategoryDef[] | null | undefined,
  grain: Grain
): GrainSummary {
  const cats = categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  // Points possible per period = sum of scoring categories' maxes (noPoints excluded).
  const maxPerPeriod = cats.reduce((s, c) => (c.noPoints ? s : s + (c.maxPoints || 0)), 0);

  const buckets = new Map<string, Bucket>();
  for (const row of scores) {
    if (!row || typeof row.score_date !== "string") continue;
    const { key, label } = bucketFor(grain, row.score_date);
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, count: 0, earned: 0, possible: 0, perCat: {} };
      buckets.set(key, b);
    }
    const pts = extractScores(row, cats);
    let rowEarned = 0;
    for (const cat of cats) {
      const v = pts[cat.id] ?? 0;
      b.perCat[cat.id] = (b.perCat[cat.id] ?? 0) + v;
      if (!cat.noPoints) rowEarned += v;
    }
    b.count += 1;
    b.earned += rowEarned;
    b.possible += maxPerPeriod;
  }

  const ordered = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  const shown = ordered.slice(-CAP[grain]);

  const seriesOut: TimeBucket[] = shown.map((b) => ({
    label: b.label,
    pct: b.possible > 0 ? Math.round((b.earned / b.possible) * 100) : 0,
    count: b.count,
  }));

  const perCatTotal: Record<string, number> = {};
  let count = 0;
  for (const b of shown) {
    count += b.count;
    for (const cat of cats) perCatTotal[cat.id] = (perCatTotal[cat.id] ?? 0) + (b.perCat[cat.id] ?? 0);
  }
  const breakdownOut = cats.map((cat, i) => {
    const avg = count > 0 ? (perCatTotal[cat.id] ?? 0) / count : 0;
    const pct = cat.maxPoints > 0 ? Math.round((avg / cat.maxPoints) * 100) : 0;
    return { id: cat.id, name: cat.name, pct, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  return { series: seriesOut, breakdown: breakdownOut, totalCount: count };
}

export default function BehaviorCharts({
  scores,
  categories,
}: {
  scores: ChartScoreRow[];
  categories?: CategoryDef[] | null;
}) {
  const [grain, setGrain] = useState<Grain>("daily");

  const { series, breakdown, totalCount } = useMemo(
    () => summarizeBehavior(scores, categories, grain),
    [scores, categories, grain]
  );

  const cardStyle: React.CSSProperties = {
    background: "var(--ssd-surface)",
    border: "1px solid var(--ssd-border)",
    borderRadius: "var(--ssd-radius)",
    padding: "12px 16px",
  };

  return (
    <div>
      {/* Grain toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {(["daily", "weekly", "monthly"] as Grain[]).map((g) => {
          const active = g === grain;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGrain(g)}
              aria-pressed={active}
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 14px",
                borderRadius: 999,
                cursor: "pointer",
                border: `1px solid ${active ? "var(--ssd-green)" : "var(--ssd-border)"}`,
                background: active ? "var(--ssd-green)" : "var(--ssd-surface)",
                color: active ? "#fff" : "var(--ssd-text-muted)",
                textTransform: "capitalize",
              }}
            >
              {g}
            </button>
          );
        })}
      </div>

      {series.length === 0 ? (
        <div style={{ ...cardStyle, color: "var(--ssd-text-muted)", fontSize: 14 }}>
          No scores yet.
        </div>
      ) : (
        <div style={{ ...cardStyle, padding: "16px 12px 12px" }}>
          <BehaviorOverTimeChart data={series} />
          <div
            style={{
              fontSize: 11,
              color: "var(--ssd-text-muted)",
              textAlign: "center",
              margin: "8px 0 2px",
            }}
          >
            Last {series.length} {GRAIN_NOUN[grain]} · % of behavior goals met
          </div>

          {/* Per-category breakdown — teacher's own labels */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--ssd-border)" }}>
            <div
              style={{
                fontFamily: "var(--ssd-font-mono), ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ssd-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 12,
              }}
            >
              By category
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {breakdown.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(72px, 96px) 1fr 40px",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ssd-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={b.name}
                  >
                    {b.name}
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 6,
                      background: "var(--ssd-paper)",
                      border: "1px solid var(--ssd-border)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${b.pct}%`,
                        height: "100%",
                        background: b.color,
                        borderRadius: 6,
                        transition: "width .25s ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ssd-ink)",
                      textAlign: "right",
                    }}
                  >
                    {b.pct}%
                  </div>
                </div>
              ))}
            </div>
            {totalCount > 0 ? (
              <div style={{ fontSize: 11, color: "var(--ssd-text-muted)", marginTop: 10 }}>
                Average across {totalCount} logged period{totalCount === 1 ? "" : "s"} in this range.
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

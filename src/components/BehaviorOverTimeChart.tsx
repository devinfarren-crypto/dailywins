"use client";

// The "overall %" headline chart for the magic-link behavior summary. One bar
// per time bucket (a day / week / month), height = percent of behavior goals
// met, color-graded green / gold / coral so a parent sees good vs rough periods
// at a glance.
//
// Recharts is browser-only (see CLAUDE.md) — this module is ONLY ever pulled in
// via a dynamic(..., { ssr: false }) import from BehaviorCharts, so it never
// reaches the server renderer.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

export interface TimeBucket {
  label: string;
  pct: number;
  count: number; // period-entries logged in this bucket
}

function barColor(pct: number): string {
  if (pct >= 80) return "#3a7c6a"; // green — strong
  if (pct >= 60) return "#f0b647"; // gold — mixed
  return "#e07850"; // coral — needs attention
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { payload: TimeBucket }[];
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e4e7e3",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
        color: "#2c3e50",
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{label}</div>
      <div>{d.pct}% of goals met</div>
      <div style={{ color: "#8a9690" }}>
        {d.count} period{d.count === 1 ? "" : "s"} logged
      </div>
    </div>
  );
}

export default function BehaviorOverTimeChart({ data }: { data: TimeBucket[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#8a9690" }}
            tickLine={false}
            axisLine={{ stroke: "#e4e7e3" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 11, fill: "#8a9690" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
            width={44}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(58,124,106,0.06)" }} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d, i) => (
              <Cell key={i} fill={barColor(d.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";

const COLORS = {
  primary: "#e07850",
  secondary: "#3a7c6a",
  accent: "#f0b647",
  dark: "#2c3e50",
};

const PERIODS = [
  "Period 1",
  "Period 2",
  "Period 3",
  "Period 4",
  "Period 5",
  "Period 6",
  "Period 7",
  "Advocacy",
];

type ArrivalValue = "On Time" | "L" | "L-E";
type ToggleValue = "Yes" | "No";
type ScaleValue = 0 | 1 | 2 | 3;

interface PeriodScores {
  arrival: ArrivalValue;
  compliance: ScaleValue;
  social: ScaleValue;
  onTask: ScaleValue;
  phoneAway: ToggleValue;
}

const DEFAULT_SCORES: PeriodScores = {
  arrival: "On Time",
  compliance: 0,
  social: 0,
  onTask: 0,
  phoneAway: "No",
};

const DEMO_STUDENTS = ["Alex Johnson", "Maria Garcia", "James Wilson", "Sarah Chen"];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function calculateProgress(scores: Record<string, PeriodScores>): number {
  const periods = Object.values(scores);
  if (periods.length === 0) return 0;
  let total = 0;
  let max = 0;
  for (const p of periods) {
    total += p.arrival === "On Time" ? 3 : p.arrival === "L-E" ? 1 : 0;
    total += p.compliance;
    total += p.social;
    total += p.onTask;
    total += p.phoneAway === "Yes" ? 3 : 0;
    max += 15; // 3+3+3+3+3
  }
  return max === 0 ? 0 : Math.round((total / max) * 100);
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(DEMO_STUDENTS[0]);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [scores, setScores] = useState<Record<string, PeriodScores>>(() => {
    const initial: Record<string, PeriodScores> = {};
    for (const period of PERIODS) {
      initial[period] = { ...DEFAULT_SCORES };
    }
    return initial;
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/");
      } else {
        setUser(user);
      }
      setLoading(false);
    });
  }, [router, supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  const updateScore = <K extends keyof PeriodScores>(
    period: string,
    category: K,
    value: PeriodScores[K]
  ) => {
    setScores((prev) => ({
      ...prev,
      [period]: { ...prev[period], [category]: value },
    }));
  };

  const cycleArrival = (period: string) => {
    const order: ArrivalValue[] = ["On Time", "L", "L-E"];
    const current = scores[period].arrival;
    const next = order[(order.indexOf(current) + 1) % order.length];
    updateScore(period, "arrival", next);
  };

  const togglePhoneAway = (period: string) => {
    updateScore(
      period,
      "phoneAway",
      scores[period].phoneAway === "Yes" ? "No" : "Yes"
    );
  };

  const cycleScale = (period: string, category: "compliance" | "social" | "onTask") => {
    const current = scores[period][category];
    const next = ((current + 1) % 4) as ScaleValue;
    updateScore(period, category, next);
  };

  const progress = calculateProgress(scores);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: COLORS.dark }}>
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen" style={{ background: "#f5f5f0" }}>
      {/* Header */}
      <header className="shadow-md" style={{ background: COLORS.dark }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: COLORS.primary }}
            >
              DW
            </div>
            <h1 className="text-xl font-bold text-white">DailyWins</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300">
              {user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-80"
              style={{ background: COLORS.primary }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Controls Row */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Student Selector */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.dark }}>
              Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2"
              style={{ color: COLORS.dark, focusRingColor: COLORS.primary } as React.CSSProperties}
            >
              {DEMO_STUDENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.dark }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2"
              style={{ color: COLORS.dark }}
            />
          </div>

          {/* Progress Bar */}
          <div className="ml-auto flex-1" style={{ minWidth: 200, maxWidth: 400 }}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.dark }}>
              Daily Score: {progress}%
            </label>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  background:
                    progress >= 80
                      ? COLORS.secondary
                      : progress >= 50
                        ? COLORS.accent
                        : COLORS.primary,
                }}
              />
            </div>
          </div>
        </div>

        {/* Score Legend */}
        <div className="mb-4 flex flex-wrap gap-4 rounded-lg bg-white p-3 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.secondary }} />
            <span style={{ color: COLORS.dark }}>3 = Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.accent }} />
            <span style={{ color: COLORS.dark }}>2 = Good</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS.primary }} />
            <span style={{ color: COLORS.dark }}>1 = Needs Improvement</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-gray-300" />
            <span style={{ color: COLORS.dark }}>0 = Not Observed</span>
          </div>
        </div>

        {/* Scoring Grid */}
        <div className="overflow-x-auto rounded-xl bg-white shadow-md">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: COLORS.dark }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">
                  Period
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Arrival
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Compliance
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Social
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  On-Task
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">
                  Phone Away
                </th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period, i) => (
                <tr
                  key={period}
                  className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                  style={i % 2 === 0 ? { background: "#fafaf7" } : {}}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: COLORS.dark }}>
                    {period}
                  </td>

                  {/* Arrival Toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => cycleArrival(period)}
                      className="inline-block min-w-[70px] rounded-full px-3 py-1 text-xs font-bold text-white transition-transform hover:scale-105"
                      style={{
                        background:
                          scores[period].arrival === "On Time"
                            ? COLORS.secondary
                            : scores[period].arrival === "L-E"
                              ? COLORS.accent
                              : COLORS.primary,
                      }}
                    >
                      {scores[period].arrival}
                    </button>
                  </td>

                  {/* Compliance 0-3 */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => cycleScale(period, "compliance")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white transition-transform hover:scale-110"
                      style={{
                        background: scaleColor(scores[period].compliance),
                      }}
                    >
                      {scores[period].compliance}
                    </button>
                  </td>

                  {/* Social 0-3 */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => cycleScale(period, "social")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white transition-transform hover:scale-110"
                      style={{
                        background: scaleColor(scores[period].social),
                      }}
                    >
                      {scores[period].social}
                    </button>
                  </td>

                  {/* On-Task 0-3 */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => cycleScale(period, "onTask")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white transition-transform hover:scale-110"
                      style={{
                        background: scaleColor(scores[period].onTask),
                      }}
                    >
                      {scores[period].onTask}
                    </button>
                  </td>

                  {/* Phone Away Toggle */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePhoneAway(period)}
                      className="inline-block min-w-[50px] rounded-full px-3 py-1 text-xs font-bold text-white transition-transform hover:scale-105"
                      style={{
                        background:
                          scores[period].phoneAway === "Yes"
                            ? COLORS.secondary
                            : COLORS.primary,
                      }}
                    >
                      {scores[period].phoneAway}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function scaleColor(value: ScaleValue): string {
  switch (value) {
    case 3:
      return COLORS.secondary;
    case 2:
      return COLORS.accent;
    case 1:
      return COLORS.primary;
    case 0:
      return "#b0b0b0";
  }
}

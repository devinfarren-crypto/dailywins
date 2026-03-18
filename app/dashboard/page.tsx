"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";

const COLORS = {
  primary: "#e07850",
  secondary: "#3a7c6a",
  accent: "#f0b647",
  dark: "#2c3e50",
  red: "#e74c3c",
  gold: "#f0b647",
  green: "#3a7c6a",
  blue: "#3498db",
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

type ArrivalValue = "On Time" | "L" | "L/E";
type ToggleValue = "Yes" | "No";
type ScaleValue = 0 | 1 | 2 | 3;

interface PeriodScores {
  arrival: ArrivalValue;
  compliance: ScaleValue;
  social: ScaleValue;
  onTask: ScaleValue;
  phoneAway: ToggleValue;
}

interface StudentNote {
  id: number;
  text: string;
  shared: boolean;
  timestamp: string;
}

const DEFAULT_SCORES: PeriodScores = {
  arrival: "On Time",
  compliance: 0,
  social: 0,
  onTask: 0,
  phoneAway: "No",
};

type ScheduleType = "Regular" | "Wednesday" | "Minimum Day" | "Reverse Minimum" | "Finals" | "Rally";
type SchoolName = "Cosumnes Oaks High School" | "Pleasant Grove High School";

interface PeriodSlot {
  label: string;
  start: string;
  end: string;
}

interface BellSchedule {
  periods: PeriodSlot[];
}

const BELL_SCHEDULES: Record<SchoolName, Record<ScheduleType, BellSchedule>> = {
  "Cosumnes Oaks High School": {
    Regular: {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:50" },
        { label: "Period 2", start: "8:55", end: "9:45" },
        { label: "Period 3", start: "9:50", end: "10:40" },
        { label: "Advocacy", start: "10:40", end: "11:10" },
        { label: "Period 4", start: "11:15", end: "12:05" },
        { label: "Lunch", start: "12:05", end: "12:40" },
        { label: "Period 5", start: "12:45", end: "1:35" },
        { label: "Period 6", start: "1:40", end: "2:30" },
        { label: "Period 7", start: "2:35", end: "3:25" },
      ],
    },
    Wednesday: {
      periods: [
        { label: "Period 1", start: "9:00", end: "9:40" },
        { label: "Period 2", start: "9:45", end: "10:25" },
        { label: "Period 3", start: "10:30", end: "11:10" },
        { label: "Advocacy", start: "11:10", end: "11:40" },
        { label: "Period 4", start: "11:45", end: "12:25" },
        { label: "Lunch", start: "12:25", end: "1:00" },
        { label: "Period 5", start: "1:05", end: "1:45" },
        { label: "Period 6", start: "1:50", end: "2:30" },
        { label: "Period 7", start: "2:35", end: "3:15" },
      ],
    },
    "Minimum Day": {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:30" },
        { label: "Period 2", start: "8:35", end: "9:05" },
        { label: "Period 3", start: "9:10", end: "9:40" },
        { label: "Period 4", start: "9:45", end: "10:15" },
        { label: "Period 5", start: "10:20", end: "10:50" },
        { label: "Period 6", start: "10:55", end: "11:25" },
        { label: "Period 7", start: "11:30", end: "12:00" },
      ],
    },
    "Reverse Minimum": {
      periods: [
        { label: "Period 7", start: "8:00", end: "8:30" },
        { label: "Period 6", start: "8:35", end: "9:05" },
        { label: "Period 5", start: "9:10", end: "9:40" },
        { label: "Period 4", start: "9:45", end: "10:15" },
        { label: "Period 3", start: "10:20", end: "10:50" },
        { label: "Period 2", start: "10:55", end: "11:25" },
        { label: "Period 1", start: "11:30", end: "12:00" },
      ],
    },
    Finals: {
      periods: [
        { label: "Final 1", start: "8:00", end: "9:30" },
        { label: "Final 2", start: "9:45", end: "11:15" },
        { label: "Lunch", start: "11:15", end: "11:50" },
        { label: "Final 3", start: "11:55", end: "1:25" },
      ],
    },
    Rally: {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:40" },
        { label: "Period 2", start: "8:45", end: "9:25" },
        { label: "Period 3", start: "9:30", end: "10:10" },
        { label: "Rally", start: "10:15", end: "11:00" },
        { label: "Advocacy", start: "11:00", end: "11:25" },
        { label: "Period 4", start: "11:30", end: "12:10" },
        { label: "Lunch", start: "12:10", end: "12:45" },
        { label: "Period 5", start: "12:50", end: "1:30" },
        { label: "Period 6", start: "1:35", end: "2:15" },
        { label: "Period 7", start: "2:20", end: "3:00" },
      ],
    },
  },
  "Pleasant Grove High School": {
    Regular: {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:52" },
        { label: "Period 2", start: "8:57", end: "9:49" },
        { label: "Period 3", start: "9:54", end: "10:46" },
        { label: "Advocacy", start: "10:46", end: "11:16" },
        { label: "Period 4", start: "11:21", end: "12:13" },
        { label: "Lunch", start: "12:13", end: "12:48" },
        { label: "Period 5", start: "12:53", end: "1:45" },
        { label: "Period 6", start: "1:50", end: "2:42" },
        { label: "Period 7", start: "2:47", end: "3:30" },
      ],
    },
    Wednesday: {
      periods: [
        { label: "Period 1", start: "9:00", end: "9:42" },
        { label: "Period 2", start: "9:47", end: "10:29" },
        { label: "Period 3", start: "10:34", end: "11:16" },
        { label: "Advocacy", start: "11:16", end: "11:46" },
        { label: "Period 4", start: "11:51", end: "12:33" },
        { label: "Lunch", start: "12:33", end: "1:08" },
        { label: "Period 5", start: "1:13", end: "1:55" },
        { label: "Period 6", start: "2:00", end: "2:42" },
        { label: "Period 7", start: "2:47", end: "3:20" },
      ],
    },
    "Minimum Day": {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:30" },
        { label: "Period 2", start: "8:35", end: "9:05" },
        { label: "Period 3", start: "9:10", end: "9:40" },
        { label: "Period 4", start: "9:45", end: "10:15" },
        { label: "Period 5", start: "10:20", end: "10:50" },
        { label: "Period 6", start: "10:55", end: "11:25" },
        { label: "Period 7", start: "11:30", end: "12:00" },
      ],
    },
    "Reverse Minimum": {
      periods: [
        { label: "Period 7", start: "8:00", end: "8:30" },
        { label: "Period 6", start: "8:35", end: "9:05" },
        { label: "Period 5", start: "9:10", end: "9:40" },
        { label: "Period 4", start: "9:45", end: "10:15" },
        { label: "Period 3", start: "10:20", end: "10:50" },
        { label: "Period 2", start: "10:55", end: "11:25" },
        { label: "Period 1", start: "11:30", end: "12:00" },
      ],
    },
    Finals: {
      periods: [
        { label: "Final 1", start: "8:00", end: "9:30" },
        { label: "Final 2", start: "9:45", end: "11:15" },
        { label: "Lunch", start: "11:15", end: "11:50" },
        { label: "Final 3", start: "11:55", end: "1:25" },
      ],
    },
    Rally: {
      periods: [
        { label: "Period 1", start: "8:00", end: "8:42" },
        { label: "Period 2", start: "8:47", end: "9:29" },
        { label: "Period 3", start: "9:34", end: "10:16" },
        { label: "Rally", start: "10:21", end: "11:05" },
        { label: "Advocacy", start: "11:05", end: "11:30" },
        { label: "Period 4", start: "11:35", end: "12:17" },
        { label: "Lunch", start: "12:17", end: "12:52" },
        { label: "Period 5", start: "12:57", end: "1:39" },
        { label: "Period 6", start: "1:44", end: "2:26" },
        { label: "Period 7", start: "2:31", end: "3:10" },
      ],
    },
  },
};

const SCHOOLS: SchoolName[] = ["Cosumnes Oaks High School", "Pleasant Grove High School"];
const SCHEDULE_TYPES: ScheduleType[] = ["Regular", "Wednesday", "Minimum Day", "Reverse Minimum", "Finals", "Rally"];

const QUICK_FILL_DEFAULTS: PeriodScores = {
  arrival: "On Time",
  compliance: 2,
  social: 2,
  onTask: 2,
  phoneAway: "Yes",
};

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function periodPoints(p: PeriodScores): number {
  const arrivalPts = p.arrival === "On Time" ? 3 : p.arrival === "L/E" ? 1 : 0;
  const phonePts = p.phoneAway === "Yes" ? 3 : 0;
  return arrivalPts + p.compliance + p.social + p.onTask + phonePts;
}

function calculateProgress(scores: Record<string, PeriodScores>): { earned: number; possible: number; pct: number } {
  const periods = Object.values(scores);
  if (periods.length === 0) return { earned: 0, possible: 0, pct: 0 };
  let earned = 0;
  const possible = periods.length * 15;
  for (const p of periods) {
    earned += periodPoints(p);
  }
  return { earned, possible, pct: possible === 0 ? 0 : Math.round((earned / possible) * 100) };
}

function scaleColor(value: ScaleValue): string {
  switch (value) {
    case 3: return COLORS.secondary;
    case 2: return COLORS.accent;
    case 1: return COLORS.primary;
    case 0: return "#b0b0b0";
  }
}

// Confetti particle
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiColors = [COLORS.primary, COLORS.secondary, COLORS.accent, COLORS.blue, "#e74c3c", "#9b59b6"];
    const particles: Particle[] = [];
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * -1,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 2,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        size: Math.random() * 8 + 4,
        life: 1,
      });
    }
    particlesRef.current = particles;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.005;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
      }
      ctx.globalAlpha = 1;
      if (alive) {
        animRef.current = requestAnimationFrame(animate);
      }
    };
    animRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [scores, setScores] = useState<Record<string, PeriodScores>>(() => {
    const initial: Record<string, PeriodScores> = {};
    for (const period of PERIODS) {
      initial[period] = { ...DEFAULT_SCORES };
    }
    return initial;
  });
  const [selectedSchool, setSelectedSchool] = useState<SchoolName | "">(
    () => (typeof window !== "undefined" ? localStorage.getItem("dailywins_school") as SchoolName | "" : "")
  );
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType>("Regular");
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [addStudentsText, setAddStudentsText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteShared, setNoteShared] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const prevPctRef = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) {
        router.replace("/");
      } else {
        setUser(u);
      }
      setLoading(false);
    });
  }, [router, supabase.auth]);

  // Load students from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dailywins_students");
    if (saved) {
      const parsed = JSON.parse(saved) as string[];
      setStudents(parsed);
      if (parsed.length > 0) setSelectedStudent(parsed[0]);
    }
  }, []);

  // Confetti trigger
  const { pct } = calculateProgress(scores);
  useEffect(() => {
    if (pct >= 90 && prevPctRef.current < 90) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
    prevPctRef.current = pct;
  }, [pct]);

  // Derive active periods from schedule
  const activePeriods: PeriodSlot[] = selectedSchool
    ? BELL_SCHEDULES[selectedSchool][selectedSchedule].periods
    : PERIODS.map((p) => ({ label: p, start: "", end: "" }));

  // Trackable periods (exclude Lunch, Rally)
  const trackablePeriods = activePeriods.filter(
    (p) => p.label !== "Lunch" && p.label !== "Rally"
  );

  // Re-initialize scores when schedule changes
  useEffect(() => {
    setScores(() => {
      const initial: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        initial[p.label] = { ...DEFAULT_SCORES };
      }
      return initial;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchool, selectedSchedule]);

  const handleSelectSchool = (school: SchoolName) => {
    setSelectedSchool(school);
    localStorage.setItem("dailywins_school", school);
    setSelectedSchedule("Regular");
  };

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

  const quickFillAll = () => {
    setScores(() => {
      const filled: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        filled[p.label] = { ...QUICK_FILL_DEFAULTS };
      }
      return filled;
    });
  };

  const quickClearAll = () => {
    setScores(() => {
      const cleared: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        cleared[p.label] = { ...DEFAULT_SCORES };
      }
      return cleared;
    });
  };

  const quickFillColumn = (category: keyof PeriodScores) => {
    setScores((prev) => {
      const updated = { ...prev };
      for (const p of trackablePeriods) {
        updated[p.label] = { ...updated[p.label], [category]: QUICK_FILL_DEFAULTS[category] };
      }
      return updated;
    });
  };

  const handleAddStudents = () => {
    const names = addStudentsText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    const updated = [...new Set([...students, ...names])];
    setStudents(updated);
    localStorage.setItem("dailywins_students", JSON.stringify(updated));
    if (!selectedStudent && updated.length > 0) setSelectedStudent(updated[0]);
    setAddStudentsText("");
    setShowAddStudents(false);
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    const note: StudentNote = {
      id: Date.now(),
      text: noteText.trim(),
      shared: noteShared,
      timestamp: new Date().toLocaleString(),
    };
    setNotes((prev) => [note, ...prev]);
    setNoteText("");
  };

  const handleDeleteNote = (id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const { earned, possible } = calculateProgress(scores);

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: COLORS.dark }}>
        <div style={{ color: "white", fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const hasStudents = students.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <ConfettiCanvas active={showConfetti} />

      {/* Header */}
      <header style={{ background: COLORS.dark, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              background: COLORS.primary,
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
            }}>
              DW
            </div>
            <h1 style={{ color: "white", fontSize: 22, fontWeight: 700, margin: 0 }}>DailyWins</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "#ccc", fontSize: 13 }}>{user.email}</span>
            <button
              onClick={handleSignOut}
              style={{
                background: COLORS.primary,
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Welcome Banner */}
        {!hasStudents && (
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
            marginBottom: 24,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            border: `2px dashed ${COLORS.accent}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h2 style={{ color: COLORS.dark, fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
              Welcome to DailyWins!
            </h2>
            <p style={{ color: "#666", fontSize: 15, margin: "0 0 20px" }}>
              Add your students to get started tracking daily behavior wins.
            </p>
            <button
              onClick={() => setShowAddStudents(true)}
              style={{
                background: COLORS.secondary,
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Add Students
            </button>
          </div>
        )}

        {/* Controls Row */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
          {/* Student Selector */}
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark }}>
              Student
            </label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              style={{
                borderRadius: 8,
                border: "1px solid #d0d0d0",
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.dark,
                background: "white",
                minWidth: 160,
              }}
            >
              {students.length === 0 && <option value="">No students</option>}
              {students.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                borderRadius: 8,
                border: "1px solid #d0d0d0",
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.dark,
                background: "white",
              }}
            />
          </div>

          {/* Add Students Button */}
          <button
            onClick={() => setShowAddStudents(true)}
            style={{
              background: COLORS.secondary,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              height: 38,
            }}
          >
            + Students
          </button>

          {/* Notes Button */}
          <button
            onClick={() => setShowNotes(true)}
            style={{
              background: COLORS.dark,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              height: 38,
              position: "relative",
            }}
          >
            📝 Notes
            {notes.length > 0 && (
              <span style={{
                position: "absolute",
                top: -6,
                right: -6,
                background: COLORS.primary,
                color: "white",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 800,
              }}>
                {notes.length}
              </span>
            )}
          </button>

          {/* Schedule Button */}
          <button
            onClick={() => setShowSchedule(true)}
            style={{
              background: COLORS.accent,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              height: 38,
            }}
          >
            🕐 Schedule
          </button>

          {/* Quick Schedule Switcher */}
          {selectedSchool && (
            <div>
              <select
                value={selectedSchedule}
                onChange={(e) => setSelectedSchedule(e.target.value as ScheduleType)}
                style={{
                  borderRadius: 8,
                  border: "1px solid #d0d0d0",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.dark,
                  background: "white",
                  height: 38,
                }}
              >
                {SCHEDULE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Progress Bar */}
          <div style={{ marginLeft: "auto", flex: 1, minWidth: 220, maxWidth: 420 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark }}>
              Daily Score
            </label>
            <div style={{ position: "relative", height: 28, borderRadius: 14, overflow: "hidden", background: "#e0e0e0" }}>
              {/* Zone segments */}
              <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "100%", background: COLORS.red, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: "50%", width: "20%", height: "100%", background: COLORS.gold, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: "70%", width: "20%", height: "100%", background: COLORS.green, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: "90%", width: "10%", height: "100%", background: COLORS.blue, opacity: 0.25 }} />
              {/* Fill */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${pct}%`,
                borderRadius: 14,
                background: pct >= 90 ? COLORS.blue : pct >= 70 ? COLORS.green : pct >= 50 ? COLORS.gold : COLORS.red,
                transition: "width 0.4s ease, background 0.4s ease",
              }} />
              {/* Star icon and label */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: pct > 45 ? "white" : COLORS.dark,
                textShadow: pct > 45 ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                gap: 4,
              }}>
                <span>⭐</span>
                <span>{earned} / {possible} pts ({pct}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scoring Grid */}
        {hasStudents && (
          <div style={{ overflowX: "auto", borderRadius: 14, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.dark }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Period
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Arrival
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Compliance
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Social
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    On-Task
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Phone Away
                  </th>
                  <th style={{ padding: "12px 8px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Pts
                  </th>
                </tr>
                {/* Quick Fill Row */}
                <tr style={{ background: "#f8f4ef" }}>
                  <td style={{ padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={quickFillAll}
                        style={{
                          background: COLORS.secondary,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ⚡ All
                      </button>
                      <button
                        onClick={quickClearAll}
                        style={{
                          background: COLORS.primary,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✕ Clear
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => quickFillColumn("arrival")}
                      style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      All → On Time
                    </button>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => quickFillColumn("compliance")}
                      style={{ background: COLORS.accent, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      All → 2
                    </button>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => quickFillColumn("social")}
                      style={{ background: COLORS.accent, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      All → 2
                    </button>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => quickFillColumn("onTask")}
                      style={{ background: COLORS.accent, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      All → 2
                    </button>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => quickFillColumn("phoneAway")}
                      style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                    >
                      All → Yes
                    </button>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 11, color: "#999" }}>—</td>
                </tr>
              </thead>
              <tbody>
                {trackablePeriods.map((slot, i) => {
                  const ps = scores[slot.label] ?? { ...DEFAULT_SCORES };
                  const pts = periodPoints(ps);
                  return (
                    <tr
                      key={slot.label + i}
                      style={{
                        background: i % 2 === 0 ? "#fafaf7" : "white",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 700, color: COLORS.dark }}>
                        <div>{slot.label}</div>
                        {slot.start && (
                          <div style={{ fontSize: 10, fontWeight: 500, color: "#999", marginTop: 1 }}>
                            {slot.start} – {slot.end}
                          </div>
                        )}
                      </td>

                      {/* Arrival - 3 separate buttons */}
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {(["On Time", "L", "L/E"] as ArrivalValue[]).map((val) => (
                            <button
                              key={val}
                              onClick={() => updateScore(slot.label, "arrival", val)}
                              style={{
                                background: ps.arrival === val
                                  ? (val === "On Time" ? COLORS.secondary : val === "L/E" ? COLORS.accent : COLORS.primary)
                                  : "#e8e8e8",
                                color: ps.arrival === val ? "white" : "#888",
                                border: "none",
                                borderRadius: 6,
                                padding: "5px 8px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                minWidth: val === "On Time" ? 58 : 32,
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Compliance 0-3 buttons */}
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {([0, 1, 2, 3] as ScaleValue[]).map((val) => (
                            <button
                              key={val}
                              onClick={() => updateScore(slot.label, "compliance", val)}
                              style={{
                                background: ps.compliance === val ? scaleColor(val) : "#e8e8e8",
                                color: ps.compliance === val ? "white" : "#888",
                                border: "none",
                                borderRadius: 6,
                                width: 32,
                                height: 32,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Social 0-3 buttons */}
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {([0, 1, 2, 3] as ScaleValue[]).map((val) => (
                            <button
                              key={val}
                              onClick={() => updateScore(slot.label, "social", val)}
                              style={{
                                background: ps.social === val ? scaleColor(val) : "#e8e8e8",
                                color: ps.social === val ? "white" : "#888",
                                border: "none",
                                borderRadius: 6,
                                width: 32,
                                height: 32,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* On-Task 0-3 buttons */}
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {([0, 1, 2, 3] as ScaleValue[]).map((val) => (
                            <button
                              key={val}
                              onClick={() => updateScore(slot.label, "onTask", val)}
                              style={{
                                background: ps.onTask === val ? scaleColor(val) : "#e8e8e8",
                                color: ps.onTask === val ? "white" : "#888",
                                border: "none",
                                borderRadius: 6,
                                width: 32,
                                height: 32,
                                fontSize: 13,
                                fontWeight: 800,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Phone Away - Yes/No buttons */}
                      <td style={{ padding: "8px 6px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
                          {(["Yes", "No"] as ToggleValue[]).map((val) => (
                            <button
                              key={val}
                              onClick={() => updateScore(slot.label, "phoneAway", val)}
                              style={{
                                background: ps.phoneAway === val
                                  ? (val === "Yes" ? COLORS.secondary : COLORS.primary)
                                  : "#e8e8e8",
                                color: ps.phoneAway === val ? "white" : "#888",
                                border: "none",
                                borderRadius: 6,
                                padding: "5px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Period Points */}
                      <td style={{
                        padding: "8px 10px",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: 15,
                        color: pts >= 12 ? COLORS.secondary : pts >= 8 ? COLORS.accent : COLORS.primary,
                      }}>
                        {pts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legends */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
          {/* Arrival Legend */}
          <div style={{
            background: "white",
            borderRadius: 10,
            padding: "12px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            flex: 1,
            minWidth: 280,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 6 }}>
              Arrival
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              <span style={{ color: COLORS.secondary, fontWeight: 700 }}>On Time</span>
              {" · "}
              <span style={{ color: COLORS.primary, fontWeight: 700 }}>L</span> = Late
              {" · "}
              <span style={{ color: COLORS.accent, fontWeight: 700 }}>L/E</span> = Late Excused
            </div>
          </div>

          {/* Score Legend */}
          <div style={{
            background: "white",
            borderRadius: 10,
            padding: "12px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            flex: 1,
            minWidth: 280,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 6 }}>
              Score Scale
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#b0b0b0" }} />
                <span style={{ color: "#555" }}><b>0</b> Unacceptable</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: COLORS.primary }} />
                <span style={{ color: "#555" }}><b>1</b> Needs Work</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: COLORS.accent }} />
                <span style={{ color: "#555" }}><b>2</b> Good</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: COLORS.secondary }} />
                <span style={{ color: "#555" }}><b>3</b> Exceptional</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20, justifyContent: "center" }}>
          <button style={{
            background: COLORS.dark,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            📄 Daily PDF
          </button>
          <button style={{
            background: COLORS.dark,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            📊 Weekly PDF
          </button>
          <button style={{
            background: COLORS.secondary,
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            👁️ Parent View
          </button>
        </div>
      </main>

      {/* Add Students Modal */}
      {showAddStudents && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddStudents(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 440,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: COLORS.dark }}>Add Students</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#888" }}>Enter one student name per line</p>
            <textarea
              value={addStudentsText}
              onChange={(e) => setAddStudentsText(e.target.value)}
              placeholder={"Alex Johnson\nMaria Garcia\nJames Wilson"}
              rows={8}
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid #d0d0d0",
                padding: 12,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
                color: "#2d3a47",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAddStudents(false)}
                style={{
                  background: "#eee",
                  color: COLORS.dark,
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddStudents}
                style={{
                  background: COLORS.secondary,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Add Students
              </button>
            </div>
            {students.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>
                  Current Students ({students.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {students.map((s) => (
                    <span
                      key={s}
                      style={{
                        background: "#f0f0f0",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        color: COLORS.dark,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {s}
                      <button
                        onClick={() => {
                          const updated = students.filter((st) => st !== s);
                          setStudents(updated);
                          localStorage.setItem("dailywins_students", JSON.stringify(updated));
                          if (selectedStudent === s && updated.length > 0) setSelectedStudent(updated[0]);
                          if (updated.length === 0) setSelectedStudent("");
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#999",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 14,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotes && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNotes(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 500,
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.dark }}>
                📝 Notes {selectedStudent ? `— ${selectedStudent}` : ""}
              </h2>
              <button
                onClick={() => setShowNotes(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                ✕
              </button>
            </div>

            {/* New Note */}
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #d0d0d0",
                  padding: 12,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "vertical",
                  boxSizing: "border-box",
                  color: "#2d3a47",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.dark, cursor: "pointer" }}>
                  <div
                    onClick={() => setNoteShared(!noteShared)}
                    style={{
                      width: 40,
                      height: 22,
                      borderRadius: 11,
                      background: noteShared ? COLORS.secondary : "#ccc",
                      position: "relative",
                      transition: "background 0.2s",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "white",
                      position: "absolute",
                      top: 2,
                      left: noteShared ? 20 : 2,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </div>
                  {noteShared ? "Shared (visible to parents)" : "Private (teacher only)"}
                </label>
                <button
                  onClick={handleAddNote}
                  style={{
                    background: COLORS.secondary,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Add Note
                </button>
              </div>
            </div>

            {/* Note List */}
            {notes.length === 0 ? (
              <p style={{ textAlign: "center", color: "#999", fontSize: 14, margin: "20px 0" }}>
                No notes yet for this student.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {notes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      background: "#f8f8f5",
                      borderRadius: 10,
                      padding: "12px 14px",
                      borderLeft: `4px solid ${note.shared ? COLORS.secondary : COLORS.accent}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <p style={{ margin: 0, fontSize: 14, color: COLORS.dark, lineHeight: 1.5 }}>{note.text}</p>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 16, marginLeft: 8, flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 11, color: "#999" }}>
                      <span>{note.timestamp}</span>
                      <span style={{
                        background: note.shared ? COLORS.secondary : COLORS.accent,
                        color: "white",
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontWeight: 700,
                      }}>
                        {note.shared ? "Shared" : "Private"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showSchedule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSchedule(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 580,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.dark }}>
                🕐 Bell Schedule
              </h2>
              <button
                onClick={() => setShowSchedule(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                ✕
              </button>
            </div>

            {/* School Selection */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                Select Your School
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SCHOOLS.map((school) => (
                  <button
                    key={school}
                    onClick={() => handleSelectSchool(school)}
                    style={{
                      background: selectedSchool === school ? COLORS.secondary : "#f5f5f0",
                      color: selectedSchool === school ? "white" : COLORS.dark,
                      border: selectedSchool === school ? "none" : "1px solid #d0d0d0",
                      borderRadius: 10,
                      padding: "14px 18px",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    🏫 {school}
                    <span style={{ display: "block", fontSize: 11, fontWeight: 500, marginTop: 2, opacity: 0.8 }}>
                      Elk Grove Unified School District
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Type Selection */}
            {selectedSchool && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                  Schedule Type
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SCHEDULE_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedSchedule(type)}
                      style={{
                        background: selectedSchedule === type ? COLORS.accent : "#f0f0f0",
                        color: selectedSchedule === type ? "white" : COLORS.dark,
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Preview */}
            {selectedSchool && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                  {selectedSchedule} Schedule Preview
                </div>
                <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: COLORS.dark }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontSize: 11, fontWeight: 700 }}>Period</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Start</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>End</th>
                      <th style={{ padding: "8px 12px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Tracked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BELL_SCHEDULES[selectedSchool][selectedSchedule].periods.map((slot, i) => {
                      const isTracked = slot.label !== "Lunch" && slot.label !== "Rally";
                      return (
                        <tr key={slot.label + i} style={{ background: i % 2 === 0 ? "#fafaf7" : "white", borderTop: "1px solid #eee" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: COLORS.dark }}>{slot.label}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "#666" }}>{slot.start}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center", color: "#666" }}>{slot.end}</td>
                          <td style={{ padding: "8px 12px", textAlign: "center" }}>
                            {isTracked ? (
                              <span style={{ color: COLORS.secondary, fontWeight: 700 }}>✓</span>
                            ) : (
                              <span style={{ color: "#ccc" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowSchedule(false)}
                style={{
                  background: COLORS.secondary,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 24px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

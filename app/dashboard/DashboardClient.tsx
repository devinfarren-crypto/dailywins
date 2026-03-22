"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { syncToGoogleSheets, getValidGoogleToken } from "./sheetsSync";

const ChartViews = dynamic(() => import("./ChartViews"), { ssr: false });

// ─── Colors & Constants ───────────────────────────────────────────────────────

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

const THEMES: Record<string, { name: string; header: string; primary: string; secondary: string; accent: string; bg: string; swatch: string[] }> = {
  default: { name: "DailyWins", header: "#2c3e50", primary: "#e07850", secondary: "#3a7c6a", accent: "#f0b647", bg: "#f5f5f0", swatch: ["#2c3e50", "#e07850", "#3a7c6a"] },
  steelBlue: { name: "Steel Blue", header: "#34495e", primary: "#2980b9", secondary: "#27ae60", accent: "#f39c12", bg: "#eef3f7", swatch: ["#34495e", "#2980b9", "#27ae60"] },
  warmSlate: { name: "Warm Slate", header: "#4a4a4a", primary: "#c0392b", secondary: "#16a085", accent: "#e67e22", bg: "#f5f0ee", swatch: ["#4a4a4a", "#c0392b", "#16a085"] },
  sage: { name: "Sage Green", header: "#2d5a3d", primary: "#8e6b47", secondary: "#5d8a68", accent: "#d4a76a", bg: "#eff5f1", swatch: ["#2d5a3d", "#5d8a68", "#8e6b47"] },
  lavender: { name: "Lavender", header: "#4a3b6b", primary: "#8e5ea2", secondary: "#5b8a72", accent: "#d4a05a", bg: "#f3f0f7", swatch: ["#4a3b6b", "#8e5ea2", "#5b8a72"] },
  midnight: { name: "Midnight", header: "#1a1a2e", primary: "#e94560", secondary: "#0f3460", accent: "#f0a500", bg: "#f0f0f4", swatch: ["#1a1a2e", "#e94560", "#0f3460"] },
  sunset: { name: "Sunset", header: "#2c2c54", primary: "#ff6348", secondary: "#33d9b2", accent: "#ffb142", bg: "#f7f2ee", swatch: ["#2c2c54", "#ff6348", "#33d9b2"] },
  rose: { name: "Rose", header: "#3d3d3d", primary: "#e84393", secondary: "#00b894", accent: "#fdcb6e", bg: "#f7f0f4", swatch: ["#3d3d3d", "#e84393", "#00b894"] },
};

const FONTS = [
  { id: "nunito", name: "Nunito", value: "'Nunito', sans-serif" },
  { id: "inter", name: "Inter", value: "'Inter', sans-serif" },
  { id: "baloo", name: "Baloo 2", value: "'Baloo 2', cursive" },
  { id: "fredoka", name: "Fredoka", value: "'Fredoka', sans-serif" },
  { id: "patrick", name: "Patrick Hand", value: "'Patrick Hand', cursive" },
  { id: "quicksand", name: "Quicksand", value: "'Quicksand', sans-serif" },
];

const STAR_ICONS = ["⭐", "🏆", "🎯", "💪", "🔥", "✨", "🌟", "💎"];

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

// ─── Category Data Model ──────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  type: "arrival" | "scale" | "toggle";
  options: string[];
  pointValues: number[];
  maxPoints: number;
  noPoints?: boolean;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: "arrival", name: "Arrival", type: "arrival", options: ["On Time", "L", "L/E"], pointValues: [3, 0, 3], maxPoints: 3 },
  { id: "compliance", name: "Compliance", type: "scale", options: ["0", "1", "2", "3"], pointValues: [0, 1, 2, 3], maxPoints: 3 },
  { id: "social", name: "Social", type: "scale", options: ["0", "1", "2", "3"], pointValues: [0, 1, 2, 3], maxPoints: 3 },
  { id: "onTask", name: "On-Task", type: "scale", options: ["0", "1", "2", "3"], pointValues: [0, 1, 2, 3], maxPoints: 3 },
  { id: "homework", name: "Homework", type: "toggle", options: ["Yes", "No"], pointValues: [1, 0], maxPoints: 1, noPoints: true },
];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface StudentNote {
  id: string;
  text: string;
  shared: boolean;
  timestamp: string;
}

interface DbStudent {
  id: string;
  display_name: string;
  school_id: string;
}

interface Preferences {
  theme?: string;
  font?: string;
  starIcon?: string;
  confetti?: boolean;
  compact?: boolean;
}

interface TeacherProfile {
  teacher_id: string;
  school_id: string;
  school_name: string;
  full_name: string;
  email: string;
  categories: Category[];
  preferences?: Preferences;
}

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

// ─── Bell Schedules ───────────────────────────────────────────────────────────

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

// ─── Score Helpers ────────────────────────────────────────────────────────────

// Scores: Record<period label, Record<category id, point value | null>>
type PeriodScores = Record<string, number | null>;
type AllScores = Record<string, PeriodScores>;

/** Ensure a category has pointValues — derives them from type/options if missing */
function ensurePointValues(cat: Category): Category {
  if (cat.pointValues && cat.pointValues.length === cat.options.length) return cat;
  const maxPts = cat.maxPoints ?? 3;
  let pointValues: number[];
  if (cat.type === "scale") {
    pointValues = cat.options.map((_, i) => i);
  } else if (cat.type === "toggle") {
    pointValues = [maxPts, 0];
    // Pad if more options
    while (pointValues.length < cat.options.length) pointValues.push(0);
  } else if (cat.type === "arrival") {
    // First option = max, second = 0, third = max (On Time/L/L-E: excused = full pts)
    if (cat.options.length === 3) {
      pointValues = [maxPts, 0, maxPts];
    } else {
      pointValues = cat.options.map((_, i) => Math.max(0, maxPts - i));
    }
  } else {
    pointValues = cat.options.map((_, i) => i);
  }
  return { ...cat, pointValues };
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function calculatePeriodPoints(periodScores: PeriodScores, categories: Category[]): number {
  let pts = 0;
  for (const cat of categories) {
    if (cat.noPoints) continue;
    pts += periodScores[cat.id] ?? 0;
  }
  return pts;
}

function calculateMaxPoints(categories: Category[]): number {
  return categories.reduce((sum, cat) => cat.noPoints ? sum : sum + cat.maxPoints, 0);
}

function calculateProgress(scores: AllScores, categories: Category[]): { earned: number; possible: number; pct: number } {
  const periods = Object.values(scores);
  if (periods.length === 0) return { earned: 0, possible: 0, pct: 0 };
  const maxPerPeriod = calculateMaxPoints(categories);
  const possible = periods.length * maxPerPeriod;
  let earned = 0;
  for (const p of periods) {
    earned += calculatePeriodPoints(p, categories);
  }
  return { earned, possible, pct: possible === 0 ? 0 : Math.round((earned / possible) * 100) };
}

function scaleColor(value: number | null): string {
  switch (value) {
    case 3: return COLORS.secondary;
    case 2: return COLORS.accent;
    case 1: return COLORS.primary;
    case 0: return "#b0b0b0";
    default: return "#e8e8e8";
  }
}

/** Get the point value for a given option index in a category */
function getPointValue(cat: Category, optionIndex: number): number {
  if (!cat.pointValues) return optionIndex;
  return cat.pointValues[optionIndex] ?? 0;
}

/** Find which option index corresponds to a stored point value. Returns -1 if not found. */
function getOptionIndexForPoints(cat: Category, points: number): number {
  if (!cat.pointValues) return points;
  return cat.pointValues.indexOf(points);
}

/** Get the option label for a stored point value */
function getOptionLabel(cat: Category, points: number | null): string {
  if (points === null) return "\u2014";
  const idx = getOptionIndexForPoints(cat, points);
  if (idx >= 0) return cat.options[idx];
  return String(points);
}

/** Get color for an arrival-type button based on option index */
function arrivalButtonColor(cat: Category, optionIndex: number): string {
  const pv = cat.pointValues[optionIndex];
  if (pv === cat.maxPoints) return COLORS.secondary;
  if (pv === 0) return COLORS.primary;
  return COLORS.accent;
}

/** Get color for a toggle-type button based on option index */
function toggleButtonColor(optionIndex: number): string {
  return optionIndex === 0 ? COLORS.secondary : COLORS.primary;
}

/** Quick fill default value for a category */
function quickFillDefault(cat: Category): number {
  if (cat.type === "scale") {
    // Default to highest - 1 (e.g. 2 for 0-3 scale)
    const sorted = [...cat.pointValues].sort((a, b) => b - a);
    return sorted.length > 1 ? sorted[1] : sorted[0];
  }
  // For toggle and arrival, default to maxPoints (first/best option)
  return cat.maxPoints;
}

/** Quick fill default label for a category */
function quickFillLabel(cat: Category): string {
  const defaultVal = quickFillDefault(cat);
  const idx = getOptionIndexForPoints(cat, defaultVal);
  if (idx >= 0) return cat.options[idx];
  return String(defaultVal);
}

function makeEmptyPeriodScores(categories: Category[]): PeriodScores {
  const ps: PeriodScores = {};
  for (const cat of categories) {
    ps[cat.id] = null;
  }
  return ps;
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [dbStudents, setDbStudents] = useState<DbStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [scores, setScores] = useState<AllScores>(() => {
    const initial: AllScores = {};
    for (const period of PERIODS) {
      initial[period] = makeEmptyPeriodScores(DEFAULT_CATEGORIES);
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
  const [showParentView, setShowParentView] = useState(false);
  const [activeView, setActiveView] = useState<"entry" | "weekly" | "monthly" | "annual">("entry");
  const [showCategories, setShowCategories] = useState(false);
  const [showStaffSync, setShowStaffSync] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({});
  const [streak, setStreak] = useState(0);
  const [trendPct, setTrendPct] = useState<number | null>(null);
  const [isAbsent, setIsAbsent] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savingScore, setSavingScore] = useState(false);
  const [thresholds, setThresholds] = useState<[number, number, number]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dailywins_thresholds");
      if (saved) return JSON.parse(saved) as [number, number, number];
    }
    return [50, 70, 90];
  });
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [exportingDrive, setExportingDrive] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const prevPctRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Categories editor state
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"scale" | "toggle" | "arrival">("scale");
  const [newCatOptions, setNewCatOptions] = useState("");

  // Derived values
  const selectedStudent = dbStudents.find((s) => s.id === selectedStudentId)?.display_name ?? "";
  const hasStudents = dbStudents.length > 0;
  const hasDriveAccess = Boolean(googleAccessToken || (typeof window !== "undefined" && localStorage.getItem("dailywins_google_token")));

  const activeTheme = THEMES[prefs.theme ?? "default"] ?? THEMES.default;
  const C = {
    ...COLORS,
    dark: activeTheme.header,
    primary: activeTheme.primary,
    secondary: activeTheme.secondary,
    accent: activeTheme.accent,
  };
  const activeFont = FONTS.find((f) => f.id === (prefs.font ?? "nunito"))?.value ?? FONTS[0].value;
  const starIcon = prefs.starIcon ?? "⭐";
  const confettiEnabled = prefs.confetti !== false;
  const compactMode = prefs.compact === true;

  // ─── Auth + Teacher Profile Setup ───────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) {
        router.replace("/");
        setLoading(false);
        return;
      }
      setUser(u);

      // Capture Google access token for Drive API
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.provider_token) {
        setGoogleAccessToken(sessionData.session.provider_token);
        localStorage.setItem("dailywins_google_token", sessionData.session.provider_token);
      } else {
        // Fallback: use stored token from previous login
        const stored = localStorage.getItem("dailywins_google_token");
        if (stored) setGoogleAccessToken(stored);
      }

      const { data, error } = await supabase.rpc("ensure_teacher_exists", {
        p_auth_id: u.id,
        p_email: u.email ?? "",
        p_full_name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "Teacher",
      });

      if (error) {
        console.error("Failed to ensure teacher:", error);
        setLoading(false);
        return;
      }

      const profile = data as TeacherProfile;

      // Load categories from teacher profile or use defaults
      if (profile.categories && Array.isArray(profile.categories) && profile.categories.length > 0) {
        const normalized = (profile.categories as Category[]).map(ensurePointValues);
        profile.categories = normalized;
        setCategories(normalized);
      } else {
        // Save defaults to the teacher profile
        profile.categories = DEFAULT_CATEGORIES;
        setCategories(DEFAULT_CATEGORIES);
      }

      // Load preferences
      if (profile.preferences && typeof profile.preferences === "object") {
        setPrefs(profile.preferences as Preferences);
      }

      setTeacher(profile);

      await loadStudents(profile.school_id);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudents = async (schoolId: string) => {
    const { data, error } = await supabase
      .from("students")
      .select("id, display_name, school_id")
      .eq("school_id", schoolId)
      .order("display_name");

    if (error) {
      console.error("Failed to load students:", error);
      return;
    }

    const list = (data ?? []) as DbStudent[];
    setDbStudents(list);
    localStorage.setItem("dailywins_students", JSON.stringify(list.map((s) => s.display_name)));
    if (list.length > 0 && !selectedStudentId) {
      setSelectedStudentId(list[0].id);
    }
  };

  // ─── Confetti Trigger ───────────────────────────────────────────────────────

  const { pct } = calculateProgress(scores, categories);
  useEffect(() => {
    if (pct >= thresholds[2] && prevPctRef.current < thresholds[2]) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(timer);
    }
    prevPctRef.current = pct;
  }, [pct, thresholds]);

  const zoneColor = (p: number) =>
    p >= thresholds[2] ? COLORS.blue : p >= thresholds[1] ? COLORS.green : p >= thresholds[0] ? COLORS.gold : COLORS.red;

  // ─── Threshold Dragging ─────────────────────────────────────────────────────

  const handleThresholdDrag = useCallback((clientX: number) => {
    const idx = draggingRef.current;
    if (idx === null || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    let pctVal = Math.round(((clientX - rect.left) / rect.width) * 100);
    const min = idx === 0 ? 5 : thresholds[idx - 1] + 5;
    const max = idx === 2 ? 95 : thresholds[idx + 1] - 5;
    pctVal = Math.max(min, Math.min(max, pctVal));
    setThresholds((prev) => {
      const next = [...prev] as [number, number, number];
      next[idx] = pctVal;
      localStorage.setItem("dailywins_thresholds", JSON.stringify(next));
      return next;
    });
  }, [thresholds]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleThresholdDrag(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleThresholdDrag(e.touches[0].clientX);
    const onUp = () => { draggingRef.current = null; setDraggingIdx(null); };
    if (draggingRef.current !== null) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("touchend", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [handleThresholdDrag]);

  // ─── Active Periods ─────────────────────────────────────────────────────────

  const activePeriods: PeriodSlot[] = selectedSchool
    ? BELL_SCHEDULES[selectedSchool][selectedSchedule].periods
    : PERIODS.map((p) => ({ label: p, start: "", end: "" }));

  const trackablePeriods = activePeriods.filter(
    (p) => p.label !== "Lunch" && p.label !== "Rally"
  );

  // ─── Period Label / Number Mapping ──────────────────────────────────────────

  const periodLabelToNumber = (label: string): number => {
    const match = label.match(/Period (\d)/);
    if (match) return parseInt(match[1], 10);
    if (label === "Advocacy") return 8;
    const idx = trackablePeriods.findIndex((p) => p.label === label);
    return idx >= 0 ? idx + 1 : 1;
  };

  const periodNumberToLabel = (num: number): string => {
    if (num === 8) return "Advocacy";
    return `Period ${num}`;
  };

  // ─── Score Loading ──────────────────────────────────────────────────────────

  const loadScores = useCallback(async (studentId: string, date: string) => {
    if (!teacher) return;
    const { data, error } = await supabase
      .from("behavior_scores")
      .select("*")
      .eq("student_id", studentId)
      .eq("teacher_id", teacher.teacher_id)
      .eq("score_date", date);

    const newScores: AllScores = {};
    for (const p of trackablePeriods) {
      newScores[p.label] = makeEmptyPeriodScores(categories);
    }

    if (!error && data) {
      for (const row of data) {
        const label = periodNumberToLabel(row.period as number);
        if (label in newScores) {
          // Read the scores JSONB column
          const dbScores = row.scores as Record<string, number | null> | null;
          if (dbScores) {
            for (const cat of categories) {
              if (cat.id in dbScores) {
                newScores[label][cat.id] = dbScores[cat.id];
              }
            }
          } else {
            // Legacy format: read from individual columns
            const legacyArrival = row.arrival as number | null;
            const legacyCompliance = row.compliance as number | null;
            const legacySocial = row.social as number | null;
            const legacyOnTask = row.on_task as number | null;
            const legacyPhone = row.phone_away as boolean | null;

            if (legacyArrival !== undefined && legacyArrival !== null) newScores[label]["arrival"] = legacyArrival;
            if (legacyCompliance !== undefined && legacyCompliance !== null) newScores[label]["compliance"] = legacyCompliance;
            if (legacySocial !== undefined && legacySocial !== null) newScores[label]["social"] = legacySocial;
            if (legacyOnTask !== undefined && legacyOnTask !== null) newScores[label]["onTask"] = legacyOnTask;
            if (legacyPhone !== undefined && legacyPhone !== null) newScores[label]["phoneAway"] = legacyPhone ? 3 : 0;
          }
        }
      }
    }

    setScores(newScores);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, trackablePeriods.length, categories]);

  // ─── Notes Loading ──────────────────────────────────────────────────────────

  const loadNotes = useCallback(async (studentId: string) => {
    if (!teacher) return;
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNotes(data.map((n) => ({
        id: n.id as string,
        text: n.content as string,
        shared: !(n.is_private as boolean),
        timestamp: new Date(n.created_at as string).toLocaleString(),
      })));
    }
  }, [teacher, supabase]);

  // ─── Trigger Score + Note Load ──────────────────────────────────────────────

  useEffect(() => {
    setIsAbsent(false); // Reset absent state on student/date change
    if (selectedStudentId && teacher) {
      loadScores(selectedStudentId, selectedDate);
      loadNotes(selectedStudentId);
      // Check if student is marked absent (all periods have a special absent marker)
      supabase
        .from("behavior_scores")
        .select("scores")
        .eq("student_id", selectedStudentId)
        .eq("teacher_id", teacher.teacher_id)
        .eq("score_date", selectedDate)
        .eq("period", 1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.scores && (data.scores as Record<string, unknown>).__absent === true) {
            setIsAbsent(true);
          }
        });
    } else {
      const initial: AllScores = {};
      for (const p of trackablePeriods) {
        initial[p.label] = makeEmptyPeriodScores(categories);
      }
      setScores(initial);
      setNotes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, selectedDate, selectedSchool, selectedSchedule, teacher]);

  // ─── Streak & Trend Calculation ───────────────────────────────────────────────

  useEffect(() => {
    if (!teacher || !selectedStudentId) {
      setStreak(0);
      setTrendPct(null);
      return;
    }

    const maxPts = calculateMaxPoints(categories);
    const onTrackThreshold = thresholds[1]; // "On Track" zone start

    // Fetch last 30 days of scores for streak + trend
    const today = new Date(selectedDate + "T12:00:00");
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    supabase
      .from("behavior_scores")
      .select("score_date, period, scores")
      .eq("student_id", selectedStudentId)
      .eq("teacher_id", teacher.teacher_id)
      .gte("score_date", formatDate(thirtyDaysAgo))
      .lte("score_date", selectedDate)
      .order("score_date", { ascending: false })
      .then(({ data, error }) => {
        if (error || !data) {
          setStreak(0);
          setTrendPct(null);
          return;
        }

        // Group by date: compute daily percentage
        const byDate = new Map<string, { earned: number; possible: number }>();
        for (const row of data) {
          const d = row.score_date as string;
          const s = (row.scores as Record<string, number | null>) ?? {};
          let earned = 0;
          for (const cat of categories) {
            if (cat.noPoints) continue;
            earned += s[cat.id] ?? 0;
          }
          const existing = byDate.get(d);
          if (existing) {
            existing.earned += earned;
            existing.possible += maxPts;
          } else {
            byDate.set(d, { earned, possible: maxPts });
          }
        }

        // Streak: count consecutive school days (backwards from today) at or above On Track
        let streakCount = 0;
        const checkDate = new Date(today);
        for (let i = 0; i < 60; i++) {
          const dayOfWeek = checkDate.getDay();
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            // Skip weekends
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
          const dateStr = formatDate(checkDate);
          const day = byDate.get(dateStr);
          if (!day) break; // No data for this day — streak ends
          const dayPct = day.possible > 0 ? Math.round((day.earned / day.possible) * 100) : 0;
          if (dayPct >= onTrackThreshold) {
            streakCount++;
          } else {
            break;
          }
          checkDate.setDate(checkDate.getDate() - 1);
        }
        setStreak(streakCount);

        // Trend: this week avg vs last week avg
        const todayDate = new Date(selectedDate + "T12:00:00");
        const dayOfWeek = todayDate.getDay();
        const thisMonday = new Date(todayDate);
        thisMonday.setDate(todayDate.getDate() - ((dayOfWeek + 6) % 7));
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        const lastFriday = new Date(lastMonday);
        lastFriday.setDate(lastMonday.getDate() + 4);

        let thisWeekTotal = 0, thisWeekDays = 0;
        let lastWeekTotal = 0, lastWeekDays = 0;

        for (const [dateStr, day] of byDate.entries()) {
          const d = new Date(dateStr + "T12:00:00");
          const dayPct = day.possible > 0 ? (day.earned / day.possible) * 100 : 0;
          if (d >= thisMonday && d <= todayDate) {
            thisWeekTotal += dayPct;
            thisWeekDays++;
          } else if (d >= lastMonday && d <= lastFriday) {
            lastWeekTotal += dayPct;
            lastWeekDays++;
          }
        }

        if (thisWeekDays > 0 && lastWeekDays > 0) {
          const thisAvg = thisWeekTotal / thisWeekDays;
          const lastAvg = lastWeekTotal / lastWeekDays;
          setTrendPct(Math.round(thisAvg - lastAvg));
        } else {
          setTrendPct(null);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, selectedDate, teacher, categories, thresholds]);

  // ─── Google Sheets Auto-Sync ────────────────────────────────────────────────

  const triggerSheetSync = useCallback(async (allScores: AllScores) => {
    if (!teacher || !selectedStudentId || !selectedStudent) return;

    // Check if we have any Google token (will auto-refresh if expired)
    const hasToken = googleAccessToken || localStorage.getItem("dailywins_google_token");
    if (!hasToken) return; // No token at all — skip silently

    setSyncStatus("syncing");
    const sharedNotes = notes.filter((n) => n.shared).map((n) => n.text);

    const result = await syncToGoogleSheets({
      // Token is optional — syncToGoogleSheets will auto-refresh via /api/refresh-google-token
      token: googleAccessToken ?? localStorage.getItem("dailywins_google_token") ?? undefined,
      studentId: selectedStudentId,
      studentName: selectedStudent,
      teacherId: teacher.teacher_id,
      date: selectedDate,
      scores: allScores,
      categories,
      trackablePeriods,
      sharedNotes,
      supabase: supabase as never,
    });

    if (result.tokenExpired) {
      localStorage.removeItem("dailywins_google_token");
      localStorage.removeItem("dailywins_google_token_expiry");
      setGoogleAccessToken(null);
      setSyncStatus("error");
    } else if (result.success) {
      // Update the local token in case it was refreshed
      const freshToken = localStorage.getItem("dailywins_google_token");
      if (freshToken) setGoogleAccessToken(freshToken);
      setSyncStatus("done");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } else {
      console.error("Sheet sync failed:", result.error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleAccessToken, teacher, selectedStudentId, selectedStudent, selectedDate, categories, trackablePeriods, notes]);

  const scheduleSheetSync = useCallback((allScores: AllScores) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => triggerSheetSync(allScores), 2000);
  }, [triggerSheetSync]);

  const handleSyncNow = () => {
    triggerSheetSync(scores);
  };

  // ─── Save Scores to DB ──────────────────────────────────────────────────────

  const saveScoresToDb = useCallback(async (allScores: AllScores) => {
    if (!teacher || !selectedStudentId) return;

    const upserts = trackablePeriods
      .map((slot) => {
        const ps = allScores[slot.label];
        if (!ps) return null;
        // Build the scores JSONB object
        const scoresJson: Record<string, number | null> = {};
        for (const cat of categories) {
          scoresJson[cat.id] = ps[cat.id] ?? null;
        }
        return {
          student_id: selectedStudentId,
          teacher_id: teacher.teacher_id,
          score_date: selectedDate,
          period: periodLabelToNumber(slot.label),
          scores: scoresJson,
        };
      })
      .filter(Boolean);

    if (upserts.length === 0) return;

    const { error } = await supabase
      .from("behavior_scores")
      .upsert(upserts, { onConflict: "student_id,teacher_id,score_date,period" });

    if (error) {
      console.error("Failed to save scores:", error);
    } else {
      // Auto-sync to Google Sheets after successful DB save
      scheduleSheetSync(allScores);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, selectedStudentId, selectedDate, trackablePeriods.length, categories, scheduleSheetSync]);

  // ─── Absent Toggle ─────────────────────────────────────────────────────────

  const toggleAbsent = async () => {
    if (!teacher || !selectedStudentId) return;
    const newAbsent = !isAbsent;
    setIsAbsent(newAbsent);

    if (newAbsent) {
      // Mark absent: upsert period 1 with __absent marker
      await supabase
        .from("behavior_scores")
        .upsert({
          student_id: selectedStudentId,
          teacher_id: teacher.teacher_id,
          score_date: selectedDate,
          period: 1,
          scores: { __absent: true },
        }, { onConflict: "student_id,teacher_id,score_date,period" });
      // Clear all scores for the day
      const cleared: AllScores = {};
      for (const p of trackablePeriods) {
        cleared[p.label] = makeEmptyPeriodScores(categories);
      }
      setScores(cleared);
    } else {
      // Un-mark absent: remove the marker by setting scores to empty
      await supabase
        .from("behavior_scores")
        .upsert({
          student_id: selectedStudentId,
          teacher_id: teacher.teacher_id,
          score_date: selectedDate,
          period: 1,
          scores: {},
        }, { onConflict: "student_id,teacher_id,score_date,period" });
    }
  };

  // ─── Event Handlers ─────────────────────────────────────────────────────────

  const savePreferences = async (newPrefs: Preferences) => {
    setPrefs(newPrefs);
    if (teacher) {
      await supabase
        .from("teachers")
        .update({ preferences: newPrefs })
        .eq("id", teacher.teacher_id);
    }
  };

  const handleSelectSchool = (school: SchoolName) => {
    setSelectedSchool(school);
    localStorage.setItem("dailywins_school", school);
    setSelectedSchedule("Regular");
  };

  const handleSignOut = async () => {
    localStorage.removeItem("dailywins_google_token");
    await supabase.auth.signOut();
    router.replace("/");
  };

  const updateScore = (period: string, categoryId: string, value: number | null) => {
    setScores((prev) => {
      const updated = {
        ...prev,
        [period]: { ...prev[period], [categoryId]: value },
      };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(updated), 500);
      return updated;
    });
  };

  const quickFillAll = () => {
    setScores(() => {
      const filled: AllScores = {};
      for (const p of trackablePeriods) {
        const ps: PeriodScores = {};
        for (const cat of categories) {
          ps[cat.id] = quickFillDefault(cat);
        }
        filled[p.label] = ps;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(filled), 500);
      return filled;
    });
  };

  const quickClearAll = () => {
    setScores(() => {
      const cleared: AllScores = {};
      for (const p of trackablePeriods) {
        cleared[p.label] = makeEmptyPeriodScores(categories);
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(cleared), 500);
      return cleared;
    });
  };

  const quickFillColumn = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const defaultVal = quickFillDefault(cat);
    setScores((prev) => {
      const updated = { ...prev };
      for (const p of trackablePeriods) {
        updated[p.label] = { ...updated[p.label], [categoryId]: defaultVal };
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(updated), 500);
      return updated;
    });
  };

  // ─── Student Management ─────────────────────────────────────────────────────

  const handleAddStudents = async () => {
    const names = addStudentsText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0 || !teacher) return;

    const rows = names.map((name) => ({
      school_id: teacher.school_id,
      display_name: name,
      first_name: name,
      last_name: "",
    }));

    const { data, error } = await supabase
      .from("students")
      .insert(rows)
      .select("id, display_name, school_id");

    if (error) {
      console.error("Failed to add students:", error);
      return;
    }

    const newStudents = data as DbStudent[];
    setDbStudents((prev) => {
      const updated = [...prev, ...newStudents].sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      );
      localStorage.setItem("dailywins_students", JSON.stringify(updated.map((s) => s.display_name)));
      return updated;
    });

    if (!selectedStudentId && newStudents.length > 0) {
      setSelectedStudentId(newStudents[0].id);
    }
    setAddStudentsText("");
    setShowAddStudents(false);
  };

  // ─── Notes ──────────────────────────────────────────────────────────────────

  const handleAddNote = async () => {
    if (!noteText.trim() || !teacher || !selectedStudentId) return;

    const { data, error } = await supabase
      .from("notes")
      .insert({
        student_id: selectedStudentId,
        teacher_id: teacher.teacher_id,
        note_date: selectedDate,
        content: noteText.trim(),
        is_private: !noteShared,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save note:", error);
      return;
    }

    const note: StudentNote = {
      id: data.id as string,
      text: data.content as string,
      shared: !(data.is_private as boolean),
      timestamp: new Date(data.created_at as string).toLocaleString(),
    };
    setNotes((prev) => [note, ...prev]);
    setNoteText("");
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete note:", error);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleToggleNoteVisibility = async (id: string, currentlyShared: boolean) => {
    const newShared = !currentlyShared;
    // Optimistic update
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, shared: newShared } : n));
    // Persist to Supabase
    const { error } = await supabase
      .from("notes")
      .update({ is_private: !newShared })
      .eq("id", id);
    if (error) {
      console.error("Failed to toggle note visibility:", error);
      // Revert on failure
      setNotes((prev) => prev.map((n) => n.id === id ? { ...n, shared: currentlyShared } : n));
    }
  };

  // ─── Categories Editor ──────────────────────────────────────────────────────

  const openCategoriesEditor = () => {
    setEditCategories(categories.map((c) => ({ ...c, options: [...c.options], pointValues: [...c.pointValues] })));
    setNewCatName("");
    setNewCatType("scale");
    setNewCatOptions("");
    setShowCategories(true);
  };

  const moveCategoryUp = (idx: number) => {
    if (idx === 0) return;
    setEditCategories((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveCategoryDown = (idx: number) => {
    setEditCategories((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const deleteCategoryFromEditor = (idx: number) => {
    setEditCategories((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateCategoryName = (idx: number, name: string) => {
    setEditCategories((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], name };
      return next;
    });
  };

  const addNewCategory = () => {
    if (!newCatName.trim()) return;
    const id = newCatName.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");

    let options: string[];
    let pointValues: number[];
    let maxPoints: number;

    if (newCatType === "scale") {
      options = ["0", "1", "2", "3"];
      pointValues = [0, 1, 2, 3];
      maxPoints = 3;
    } else if (newCatType === "toggle") {
      const parts = newCatOptions.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      options = parts.length >= 2 ? [parts[0], parts[1]] : ["Yes", "No"];
      pointValues = [3, 0];
      maxPoints = 3;
    } else {
      // arrival
      const parts = newCatOptions.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      options = parts.length >= 2 ? parts : ["On Time", "L", "L/E"];
      // First option = maxPoints, rest distributed
      maxPoints = 3;
      pointValues = options.map((_, i) => {
        if (i === 0) return maxPoints;
        if (i === options.length - 1) return Math.min(1, maxPoints);
        return 0;
      });
    }

    // Make sure id is unique
    let uniqueId = id;
    let counter = 1;
    while (editCategories.some((c) => c.id === uniqueId)) {
      uniqueId = `${id}_${counter}`;
      counter++;
    }

    setEditCategories((prev) => [
      ...prev,
      { id: uniqueId, name: newCatName.trim(), type: newCatType, options, pointValues, maxPoints },
    ]);
    setNewCatName("");
    setNewCatOptions("");
  };

  const saveCategories = async () => {
    if (!teacher) return;
    setCategories(editCategories);

    const { error } = await supabase
      .from("teachers")
      .update({ categories: editCategories })
      .eq("id", teacher.teacher_id);

    if (error) {
      console.error("Failed to save categories:", error);
    }

    setShowCategories(false);
  };

  // ─── PDF Generation ─────────────────────────────────────────────────────────

  const generateDailyPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const { earned: e, possible: p, pct: pc } = calculateProgress(scores, categories);

    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("DailyWins \u2014 Daily Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Student: ${selectedStudent || "N/A"}`, 14, 32);
    doc.text(`Date: ${selectedDate}`, 14, 40);
    doc.text(`Daily Score: ${e} / ${p} pts (${pc}%)`, 14, 48);

    const headerRow = ["Period", "Time", ...categories.map((c) => c.name), "Pts"];

    const rows = trackablePeriods.map((slot) => {
      const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
      const row: string[] = [
        slot.label,
        slot.start ? `${slot.start}\u2013${slot.end}` : "",
      ];
      for (const cat of categories) {
        row.push(getOptionLabel(cat, ps[cat.id]));
      }
      row.push(String(calculatePeriodPoints(ps, categories)));
      return row;
    });

    autoTable(doc, {
      startY: 56,
      head: [headerRow],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    doc.save(`DailyWins_${selectedStudent || "report"}_${selectedDate}.pdf`);
  };

  const generateWeeklyPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("DailyWins \u2014 Weekly Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Student: ${selectedStudent || "N/A"}`, 14, 32);

    const dateObj = new Date(selectedDate + "T12:00:00");
    const dayOfWeek = dateObj.getDay();
    const monday = new Date(dateObj);
    monday.setDate(dateObj.getDate() - ((dayOfWeek + 6) % 7));

    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return formatDate(d);
    });
    const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    doc.text(`Week of: ${days[0]} to ${days[4]}`, 14, 40);

    const rows = trackablePeriods.map((slot) => {
      const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
      const todayPts = calculatePeriodPoints(ps, categories);
      const row: string[] = [slot.label];
      for (let d = 0; d < 5; d++) {
        if (days[d] === selectedDate) {
          row.push(String(todayPts));
        } else {
          row.push("\u2014");
        }
      }
      return row;
    });

    const { earned: e, possible: p, pct: pc } = calculateProgress(scores, categories);
    const totalRow = ["TOTAL"];
    for (let d = 0; d < 5; d++) {
      if (days[d] === selectedDate) {
        totalRow.push(`${e}/${p} (${pc}%)`);
      } else {
        totalRow.push("\u2014");
      }
    }
    rows.push(totalRow);

    autoTable(doc, {
      startY: 48,
      head: [["Period", ...dayLabels]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Note: Only today's data is shown. Other days will populate as data is saved.", 14, (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12 : 200);

    doc.save(`DailyWins_Weekly_${selectedStudent || "report"}_${days[0]}.pdf`);
  };

  // ─── Export to Google Drive ─────────────────────────────────────────────────

  const exportToDrive = async () => {
    if (!selectedStudent) {
      alert("Please select a student first.");
      return;
    }

    // Auto-refresh token if needed
    const { getValidGoogleToken: getToken } = await import("./sheetsSync");
    const { token: validToken, error: tokenErr } = await getToken();
    if (!validToken) {
      alert(tokenErr ?? "Google Drive access not available. Please sign out and sign in again.");
      return;
    }

    setExportingDrive(true);

    try {
      // Calculate the current week (Mon–Fri)
      const dateObj = new Date(selectedDate + "T12:00:00");
      const dayOfWeek = dateObj.getDay();
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() - ((dayOfWeek + 6) % 7));
      const days = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return formatDate(d);
      });
      const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

      // Build spreadsheet data
      const sheetTitle = `DailyWins - ${selectedStudent} - Week of ${days[0]}`;

      // Header rows
      const headerRow1 = ["DailyWins Weekly Report"];
      const headerRow2 = [`Student: ${selectedStudent}`];
      const headerRow3 = [`Week: ${days[0]} to ${days[4]}`];
      const blankRow: string[] = [];

      // Table header: Period | Mon | Tue | Wed | Thu | Fri
      const tableHeader = ["Period", ...dayLabels];

      // Data rows: for each trackable period, show points per day
      // We only have today's data; other days show "—"
      const dataRows = trackablePeriods.map((slot) => {
        const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
        const todayPts = calculatePeriodPoints(ps, categories);
        const row: string[] = [slot.label];
        for (let d = 0; d < 5; d++) {
          row.push(days[d] === selectedDate ? String(todayPts) : "");
        }
        return row;
      });

      // Total row
      const { earned: e, possible: p, pct: pc } = calculateProgress(scores, categories);
      const totalRow = ["TOTAL"];
      for (let d = 0; d < 5; d++) {
        totalRow.push(days[d] === selectedDate ? `${e}/${p} (${pc}%)` : "");
      }
      dataRows.push(totalRow);

      // Detail row for today: per-category breakdown
      const detailBlank: string[] = [];
      const detailHeader = ["Period", ...categories.map((c) => c.name), "Pts"];
      const detailRows = trackablePeriods.map((slot) => {
        const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
        const row: string[] = [slot.label];
        for (const cat of categories) {
          row.push(getOptionLabel(cat, ps[cat.id]));
        }
        row.push(String(calculatePeriodPoints(ps, categories)));
        return row;
      });

      // Combine all rows
      const allRows = [
        headerRow1,
        headerRow2,
        headerRow3,
        blankRow,
        tableHeader,
        ...dataRows,
        detailBlank,
        [`Detail for ${selectedDate}:`],
        detailHeader,
        ...detailRows,
      ];

      // Create the Google Sheet via Sheets API
      const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { title: sheetTitle },
          sheets: [{
            properties: { title: "Weekly Data" },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: allRows.map((row) => ({
                values: row.map((cell) => ({
                  userEnteredValue: { stringValue: cell },
                })),
              })),
            }],
          }],
        }),
      });

      if (!createResponse.ok) {
        const errBody = await createResponse.text();
        console.error("Drive export failed:", createResponse.status, errBody);
        if (createResponse.status === 401 || createResponse.status === 403) {
          // Token expired — clear it so next login gets a fresh one
          localStorage.removeItem("dailywins_google_token");
          setGoogleAccessToken(null);
          alert("Google Drive permission expired. Please sign out and sign back in to refresh permissions.");
        } else {
          alert(`Failed to create Google Sheet (${createResponse.status}). Check console for details.`);
        }
        return;
      }

      const sheet = await createResponse.json();
      const sheetUrl = sheet.spreadsheetUrl as string;

      // Open the new sheet in a new tab
      window.open(sheetUrl, "_blank");
    } catch (err) {
      console.error("Export to Drive error:", err);
      alert("Failed to export to Google Drive. Please try again.");
    } finally {
      setExportingDrive(false);
    }
  };

  // ─── Derived Progress Values ────────────────────────────────────────────────

  const { earned, possible } = calculateProgress(scores, categories);

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <div style={{
            background: COLORS.primary,
            width: 48,
            height: 48,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 800,
            fontSize: 18,
            margin: "0 auto 16px",
          }}>DW</div>
          <div style={{ color: COLORS.dark, fontSize: 16, fontWeight: 600 }}>Loading DailyWins...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ─── Render Cell Based on Category Type ─────────────────────────────────────

  const renderCategoryCell = (cat: Category, period: string, periodScores: PeriodScores) => {
    const currentValue = periodScores[cat.id];

    if (cat.type === "arrival") {
      return (
        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
          {cat.options.map((optLabel, optIdx) => {
            const optPoints = getPointValue(cat, optIdx);
            const isActive = currentValue !== null && currentValue === optPoints &&
              getOptionIndexForPoints(cat, currentValue) === optIdx;
            // For arrival with duplicate point values, check by finding first match
            const isSelected = currentValue !== null && optIdx === getOptionIndexForPoints(cat, currentValue);
            return (
              <button
                key={optLabel}
                onClick={() => updateScore(period, cat.id, isSelected ? null : optPoints)}
                style={{
                  background: isSelected ? arrivalButtonColor(cat, optIdx) : "#e8e8e8",
                  color: isSelected ? "white" : "#888",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  minWidth: optLabel.length > 3 ? 58 : 32,
                }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      );
    }

    if (cat.type === "scale") {
      return (
        <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
          {cat.options.map((optLabel, optIdx) => {
            const optPoints = getPointValue(cat, optIdx);
            const isSelected = currentValue !== null && currentValue === optPoints;
            return (
              <button
                key={optLabel}
                onClick={() => updateScore(period, cat.id, isSelected ? null : optPoints)}
                style={{
                  background: isSelected ? scaleColor(optPoints) : "#e8e8e8",
                  color: isSelected ? "white" : "#888",
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
                {optLabel}
              </button>
            );
          })}
        </div>
      );
    }

    // toggle
    return (
      <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>
        {cat.options.map((optLabel, optIdx) => {
          const optPoints = getPointValue(cat, optIdx);
          const isSelected = currentValue !== null && currentValue === optPoints &&
            optIdx === getOptionIndexForPoints(cat, currentValue);
          return (
            <button
              key={optLabel}
              onClick={() => updateScore(period, cat.id, isSelected ? null : optPoints)}
              style={{
                background: isSelected ? toggleButtonColor(optIdx) : "#e8e8e8",
                color: isSelected ? "white" : "#888",
                border: "none",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {optLabel}
            </button>
          );
        })}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const maxPerPeriod = calculateMaxPoints(categories);

  return (
    <>
      {/* Google Fonts for theme options */}
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Inter:wght@400;600;700;800&family=Baloo+2:wght@400;600;700;800&family=Fredoka:wght@400;600;700&family=Patrick+Hand&family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet" />
    <div style={{ minHeight: "100vh", background: activeTheme.bg, fontFamily: activeFont }}>
      <ConfettiCanvas active={showConfetti && confettiEnabled} />

      {/* Header */}
      <header style={{ background: C.dark, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* EGUSD Logo */}
            <svg width="164" height="28" viewBox="0 0 164 28" style={{ flexShrink: 0 }}>
              {([
                { letter: "E", color: "#ed1c24", cx: 14 },
                { letter: "G", color: "#3bb54a", cx: 48 },
                { letter: "U", color: "#00aeef", cx: 82 },
                { letter: "S", color: "#f7941d", cx: 116 },
                { letter: "D", color: "#92278f", cx: 150 },
              ] as const).map(({ letter, color, cx }) => (
                <g key={letter}>
                  <circle cx={cx} cy={14} r={14} fill={color} />
                  <text x={cx} y={14} textAnchor="middle" dominantBaseline="central" fill="white" fontSize="14" fontWeight="800" fontFamily="system-ui, sans-serif">
                    {letter}
                  </text>
                </g>
              ))}
            </svg>
            {/* Divider */}
            <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
            <div style={{
              background: COLORS.primary,
              width: 38,
              height: 32,
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

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px" }}>
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#127942;</div>
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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
          {/* Student Selector */}
          {hasStudents && (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                style={{
                  borderRadius: 6,
                  border: "1px solid #d0d0d0",
                  padding: "5px 10px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.dark,
                  background: "white",
                  minWidth: 140,
                  height: 32,
                }}
              >
                {dbStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
          )}

          {/* Date Picker */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                borderRadius: 6,
                border: "1px solid #d0d0d0",
                padding: "5px 10px",
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.dark,
                background: "white",
                height: 32,
              }}
            />

          {/* Add Students Button */}
          <button
            onClick={() => setShowAddStudents(true)}
            style={{
              background: COLORS.secondary,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
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
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
              position: "relative",
            }}
          >
            &#128221; Notes
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

          {/* Categories Button */}
          <button
            onClick={openCategoriesEditor}
            style={{
              background: COLORS.blue,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
            }}
          >
            &#9881; Categories
          </button>

          {/* Schedule Button */}
          <button
            onClick={() => setShowSchedule(true)}
            style={{
              background: COLORS.accent,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
            }}
          >
            &#128336; Schedule
          </button>

          {/* School Team Button */}
          <button
            onClick={() => setShowStaffSync(true)}
            style={{
              background: COLORS.blue,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
            }}
          >
            &#9729;&#65039; School Team
          </button>

          {/* Student Sync Button */}
          {hasStudents && (
            <button
              onClick={() => {
                if (!hasDriveAccess) {
                  alert("Google Drive access not available.\n\nYour school account may block Drive permissions. Sign in with a personal Google account to enable Student Sync and Drive exports.");
                  return;
                }
                handleSyncNow();
              }}
              disabled={syncStatus === "syncing"}
              title={hasDriveAccess ? "Sync current student data to Google Sheets" : "Google Drive not available — sign in with a personal account to enable"}
              style={{
                background: !hasDriveAccess ? "#bbb" : syncStatus === "done" ? COLORS.secondary : syncStatus === "error" ? COLORS.primary : syncStatus === "syncing" ? "#999" : "#4285F4",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "0 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: syncStatus === "syncing" ? "not-allowed" : "pointer",
                height: 32,
                display: "flex",
                alignItems: "center",
                gap: 4,
                transition: "background 0.3s",
              }}
            >
              {!hasDriveAccess ? "\u21BB Student Sync" : syncStatus === "syncing" ? "Syncing..." : syncStatus === "done" ? "\u2713 Synced" : syncStatus === "error" ? "Sync failed" : "\u21BB Student Sync"}
            </button>
          )}

          {/* Customize Button */}
          <button
            onClick={() => setShowCustomize(true)}
            style={{
              background: C.accent,
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "0 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              height: 32,
            }}
          >
            🎨 Customize
          </button>

          {/* Progress Bar with Draggable Thresholds */}
          <div style={{ marginLeft: "auto", flex: 1, minWidth: 220, maxWidth: 420 }}>
            {/* Score line above bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: isAbsent ? "#999" : C.dark }}>
                <span>{isAbsent ? "\uD83D\uDEAB" : starIcon}</span>
                <span>{isAbsent ? "Absent" : `${earned} / ${possible} pts (${pct}%)`}</span>
              </div>
              <span style={{
                background: isAbsent ? "#bbb" : zoneColor(pct),
                color: "white",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.5,
              }}>
                {isAbsent ? "Absent" : pct >= thresholds[2] ? "Exceptional" : pct >= thresholds[1] ? "On Track" : pct >= thresholds[0] ? "Working On It" : "Needs Support"}
              </span>
            </div>
            <div
              ref={barRef}
              style={{ position: "relative", height: 16, borderRadius: 8, background: "#e0e0e0", userSelect: "none" }}
            >
              {/* Zone segments */}
              <div style={{ position: "absolute", top: 0, left: 0, width: `${thresholds[0]}%`, height: "100%", background: COLORS.red, opacity: 0.25, borderRadius: "8px 0 0 8px" }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[0]}%`, width: `${thresholds[1] - thresholds[0]}%`, height: "100%", background: COLORS.gold, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[1]}%`, width: `${thresholds[2] - thresholds[1]}%`, height: "100%", background: COLORS.green, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[2]}%`, width: `${100 - thresholds[2]}%`, height: "100%", background: COLORS.blue, opacity: 0.25, borderRadius: "0 8px 8px 0" }} />
              {/* Fill */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${pct}%`,
                borderRadius: 8,
                background: zoneColor(pct),
                transition: draggingRef.current !== null ? "none" : "width 0.4s ease, background 0.4s ease",
              }} />
              {/* Draggable handles */}
              {thresholds.map((t, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) => { e.preventDefault(); draggingRef.current = idx; setDraggingIdx(idx); handleThresholdDrag(e.clientX); }}
                  onTouchStart={(e) => { draggingRef.current = idx; setDraggingIdx(idx); handleThresholdDrag(e.touches[0].clientX); }}
                  style={{
                    position: "absolute",
                    left: `${t}%`,
                    top: -2,
                    width: 12,
                    height: 20,
                    marginLeft: -6,
                    cursor: "ew-resize",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Tooltip — visible while dragging */}
                  {draggingIdx === idx && (
                    <div style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginBottom: 4,
                      background: COLORS.dark,
                      color: "white",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                    }}>
                      {t}%
                    </div>
                  )}
                  <div style={{
                    width: 6,
                    height: 20,
                    borderRadius: 3,
                    background: "white",
                    border: `2px solid ${draggingIdx === idx ? COLORS.dark : "#999"}`,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    transition: "border-color 0.15s",
                  }} />
                </div>
              ))}
            </div>
            {/* Zone labels */}
            <div style={{ position: "relative", height: 12, marginTop: 2, fontSize: 8, fontWeight: 700, color: "#aaa" }}>
              <span style={{ position: "absolute", left: 0, width: `${thresholds[0]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Needs Support</span>
              <span style={{ position: "absolute", left: `${thresholds[0]}%`, width: `${thresholds[1] - thresholds[0]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Working On It</span>
              <span style={{ position: "absolute", left: `${thresholds[1]}%`, width: `${thresholds[2] - thresholds[1]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>On Track</span>
              <span style={{ position: "absolute", left: `${thresholds[2]}%`, width: `${100 - thresholds[2]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Exceptional</span>
            </div>
          </div>
        </div>

        {/* View Tabs */}
        {hasStudents && (
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {(["entry", "weekly", "monthly", "annual"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                style={{
                  background: activeView === v ? COLORS.dark : "#e8e8e8",
                  color: activeView === v ? "white" : COLORS.dark,
                  border: "none",
                  borderRadius: 8,
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "all 0.15s ease",
                }}
              >
                {v === "entry" ? "Entry" : v === "weekly" ? "Weekly" : v === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
        )}

        {/* Chart Views */}
        {hasStudents && activeView !== "entry" && teacher && (
          <ChartViews
            view={activeView}
            supabase={supabase as never}
            studentId={selectedStudentId}
            studentName={selectedStudent}
            teacherId={teacher.teacher_id}
            selectedDate={selectedDate}
            categories={categories}
          />
        )}

        {/* Scoring Grid */}
        {hasStudents && activeView === "entry" && (
          <div style={{ overflowX: "auto", borderRadius: 14, background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
            <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.dark }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    Period
                  </th>
                  {categories.map((cat) => (
                    <th key={cat.id} style={{ padding: "6px 6px", textAlign: "center", color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {cat.name}
                    </th>
                  ))}
                  <th style={{ padding: "6px 6px", textAlign: "center", color: "white", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Pts
                  </th>
                </tr>
                {/* Quick Fill Row */}
                <tr style={{ background: "#f8f4ef" }}>
                  <td style={{ padding: "4px 10px" }}>
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
                        &#9889; All
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
                        &#10005; Clear
                      </button>
                      <button
                        onClick={toggleAbsent}
                        style={{
                          background: isAbsent ? "#666" : "#bbb",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {isAbsent ? "\u2713 ABS" : "\uD83D\uDEAB ABS"}
                      </button>
                    </div>
                  </td>
                  {categories.map((cat) => (
                    <td key={cat.id} style={{ padding: "4px 4px", textAlign: "center" }}>
                      <button
                        onClick={() => quickFillColumn(cat.id)}
                        style={{
                          background: cat.type === "scale" ? COLORS.accent : COLORS.secondary,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        All &rarr; {quickFillLabel(cat)}
                      </button>
                    </td>
                  ))}
                  <td style={{ padding: "4px 4px", textAlign: "center", fontSize: 10, color: "#999" }}>&mdash;</td>
                </tr>
              </thead>
              <tbody style={isAbsent ? { opacity: 0.35, pointerEvents: "none", position: "relative" } : undefined}>
                {isAbsent && (
                  <tr>
                    <td
                      colSpan={categories.length + 2}
                      style={{
                        textAlign: "center",
                        padding: "18px 0",
                        fontSize: 18,
                        fontWeight: 800,
                        color: "#999",
                        letterSpacing: 3,
                        background: "#f0f0f0",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      &#128683; ABSENT
                    </td>
                  </tr>
                )}
                {trackablePeriods.map((slot, i) => {
                  const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
                  const pts = calculatePeriodPoints(ps, categories);
                  const ptsHighThreshold = Math.round(maxPerPeriod * 0.8);
                  const ptsMidThreshold = Math.round(maxPerPeriod * 0.53);
                  return (
                    <tr
                      key={slot.label + i}
                      style={{
                        background: i % 2 === 0 ? "#fafaf7" : "white",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      <td style={{ padding: compactMode ? "2px 8px" : "4px 10px", fontWeight: 700, color: C.dark, fontSize: 13 }}>
                        <div>{slot.label}</div>
                        {slot.start && (
                          <div style={{ fontSize: 10, fontWeight: 500, color: "#999", marginTop: 1 }}>
                            {slot.start} &ndash; {slot.end}
                          </div>
                        )}
                      </td>

                      {categories.map((cat) => (
                        <td key={cat.id} style={{ padding: compactMode ? "1px 3px" : "3px 4px", textAlign: "center" }}>
                          {renderCategoryCell(cat, slot.label, ps)}
                        </td>
                      ))}

                      {/* Period Points */}
                      <td style={{
                        padding: compactMode ? "1px 3px" : "3px 6px",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: 14,
                        color: pts >= ptsHighThreshold ? COLORS.secondary : pts >= ptsMidThreshold ? COLORS.accent : COLORS.primary,
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

        {/* Legend Keys (entry view only) — Arrival cards + one Score Scale card + Toggle cards */}
        {activeView === "entry" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {/* Arrival-type cards */}
          {categories.filter((c) => c.type === "arrival").map((cat) => (
            <div key={cat.id} style={{ background: "white", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.dark, marginBottom: 3 }}>
                {cat.name}
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
                <div>
                  <span style={{ color: arrivalButtonColor(cat, 0), fontWeight: 700 }}>On Time</span>
                  <span style={{ color: "#888" }}> = full points</span>
                  <span style={{ color: "#ccc" }}> {"\u00B7"} </span>
                  <span style={{ color: arrivalButtonColor(cat, 1), fontWeight: 700 }}>L</span>
                  <span style={{ color: "#888" }}> (Late) = 0 pts</span>
                </div>
                <div>
                  <span style={{ color: arrivalButtonColor(cat, 2), fontWeight: 700 }}>L/E</span>
                  <span style={{ color: "#888" }}> (Late/Excused) = full points</span>
                </div>
              </div>
            </div>
          ))}

          {/* Streak & Trend card */}
          <div style={{ background: "white", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.dark, marginBottom: 3 }}>
              Streak &amp; Trend
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, alignItems: "center" }}>
              {/* Streak */}
              <span style={{
                fontWeight: streak >= 10 ? 900 : 700,
                fontSize: streak >= 10 ? 14 : 12,
                color: streak >= 5 ? C.secondary : streak > 0 ? C.dark : "#bbb",
              }}>
                {streak > 0
                  ? `\uD83D\uDD25 ${streak}-day streak${streak >= 10 ? "!!" : streak >= 5 ? "!" : ""}`
                  : "No active streak"}
              </span>
              {/* Trend */}
              {trendPct !== null && (
                <span style={{
                  fontWeight: 700,
                  color: trendPct > 2 ? C.secondary : trendPct < -2 ? C.primary : "#999",
                }}>
                  {trendPct > 2
                    ? `\u2191 ${trendPct}% vs last week`
                    : trendPct < -2
                      ? `\u2193 ${Math.abs(trendPct)}% vs last week`
                      : `\u2192 Same as last week`}
                </span>
              )}
              {trendPct === null && (
                <span style={{ color: "#ccc", fontSize: 11 }}>No trend data yet</span>
              )}
            </div>
          </div>

          {/* Toggle-type cards */}
          {categories.filter((c) => c.type === "toggle").map((cat) => (
            <div key={cat.id} style={{ background: "white", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", minWidth: 120 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.dark, marginBottom: 3 }}>
                {cat.name}
              </div>
              <div style={{ fontSize: 12, color: "#555" }}>
                {cat.options.join(" / ")}
              </div>
            </div>
          ))}
        </div>}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, justifyContent: "center" }}>
          <button
            onClick={generateDailyPDF}
            style={{
              background: COLORS.dark,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            &#128196; Daily PDF
          </button>
          <button
            onClick={generateWeeklyPDF}
            style={{
              background: COLORS.dark,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            &#128202; Weekly PDF
          </button>
          <button
            onClick={() => setShowParentView(true)}
            style={{
              background: COLORS.secondary,
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            &#127968; Parent View
          </button>
          <button
            onClick={() => {
              if (!hasDriveAccess) {
                alert("Google Drive access not available.\n\nYour school account may block Drive permissions. Sign in with a personal Google account to enable Student Sync and Drive exports.");
                return;
              }
              exportToDrive();
            }}
            disabled={exportingDrive}
            style={{
              background: !hasDriveAccess ? "#bbb" : exportingDrive ? "#999" : "#4285F4",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: exportingDrive ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: !hasDriveAccess ? 0.8 : exportingDrive ? 0.7 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 87.3 78" style={{ flexShrink: 0 }}>
              <path d="M6.6 66.85L29.3 78l57.4-33.15L64 33.7z" fill="#0066DA" />
              <path d="M29.3 0L6.6 11.15 29.3 78l22.7-11.15z" fill="#00AC47" />
              <path d="M86.7 44.85L64 33.7 29.3 78l22.7-11.15z" fill="#EA4335" />
              <path d="M29.3 0l34.7 33.7L86.7 44.85 52 11.15z" fill="#00832D" />
              <path d="M29.3 0L6.6 11.15l57.4 22.55L86.7 44.85z" fill="#2684FC" />
              <path d="M6.6 11.15v55.7L29.3 78V0z" fill="#FFBA00" />
            </svg>
            {exportingDrive ? "Exporting..." : "Export to Drive"}
          </button>
        </div>
      </main>

      {/* ─── Add Students Modal ──────────────────────────────────────────────── */}
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
              placeholder={"J.D.\nS.M.\nA.R."}
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
            {dbStudents.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>
                  Current Students ({dbStudents.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {dbStudents.map((s) => (
                    <span
                      key={s.id}
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
                      {s.display_name}
                      <button
                        onClick={async () => {
                          const { error } = await supabase.from("students").delete().eq("id", s.id);
                          if (error) { console.error("Failed to delete student:", error); return; }
                          setDbStudents((prev) => {
                            const updated = prev.filter((st) => st.id !== s.id);
                            localStorage.setItem("dailywins_students", JSON.stringify(updated.map((st) => st.display_name)));
                            return updated;
                          });
                          if (selectedStudentId === s.id) {
                            const remaining = dbStudents.filter((st) => st.id !== s.id);
                            setSelectedStudentId(remaining.length > 0 ? remaining[0].id : "");
                          }
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
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Notes Modal ─────────────────────────────────────────────────────── */}
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
                &#128221; Notes {selectedStudent ? `\u2014 ${selectedStudent}` : ""}
              </h2>
              <button
                onClick={() => setShowNotes(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                &#10005;
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
                        &#10005;
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 11, color: "#999" }}>
                      <span>{note.timestamp}</span>
                      <button
                        onClick={() => handleToggleNoteVisibility(note.id, note.shared)}
                        title={note.shared ? "Click to make private" : "Click to share with parent"}
                        style={{
                          background: note.shared ? COLORS.secondary : "#999",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          padding: "2px 8px",
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "background 0.2s",
                        }}
                      >
                        {note.shared ? "\uD83E\uDD1D Shared with Parent" : "\uD83D\uDD12 Private"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Parent View Modal ───────────────────────────────────────────────── */}
      {showParentView && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowParentView(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 560,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.dark }}>
                &#127968; Parent View
              </h2>
              <button
                onClick={() => setShowParentView(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                &#10005;
              </button>
            </div>

            <div style={{ background: "#f8f8f5", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark, marginBottom: 4 }}>
                {selectedStudent || "No student selected"}
              </div>
              <div style={{ fontSize: 13, color: "#888" }}>{selectedDate}</div>
            </div>

            {/* Progress summary */}
            <div style={{
              background: zoneColor(pct),
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
              color: "white",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{pct}%</div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{earned} / {possible} points</div>
            </div>

            {/* Read-only scores table */}
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: COLORS.dark }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: "white", fontSize: 11, fontWeight: 700 }}>Period</th>
                  {categories.map((cat) => (
                    <th key={cat.id} style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                      {cat.name}
                    </th>
                  ))}
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {trackablePeriods.map((slot, i) => {
                  const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
                  const pts = calculatePeriodPoints(ps, categories);
                  const ptsHighThreshold = Math.round(maxPerPeriod * 0.8);
                  const ptsMidThreshold = Math.round(maxPerPeriod * 0.53);
                  return (
                    <tr key={slot.label + i} style={{ background: i % 2 === 0 ? "#fafaf7" : "white", borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: COLORS.dark }}>{slot.label}</td>
                      {categories.map((cat) => (
                        <td key={cat.id} style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>
                          {getOptionLabel(cat, ps[cat.id])}
                        </td>
                      ))}
                      <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: pts >= ptsHighThreshold ? COLORS.secondary : pts >= ptsMidThreshold ? COLORS.accent : COLORS.primary }}>{pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Shared notes */}
            {notes.filter((n) => n.shared).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                  Teacher Notes
                </div>
                {notes.filter((n) => n.shared).map((note) => (
                  <div key={note.id} style={{ background: "#f8f8f5", borderRadius: 8, padding: "10px 12px", marginBottom: 6, borderLeft: `3px solid ${COLORS.secondary}` }}>
                    <p style={{ margin: 0, fontSize: 13, color: COLORS.dark }}>{note.text}</p>
                    <span style={{ fontSize: 11, color: "#999" }}>{note.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Schedule Modal ──────────────────────────────────────────────────── */}
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
                &#128336; Bell Schedule
              </h2>
              <button
                onClick={() => setShowSchedule(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                &#10005;
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
                    &#127979; {school}
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
                              <span style={{ color: COLORS.secondary, fontWeight: 700 }}>&#10003;</span>
                            ) : (
                              <span style={{ color: "#ccc" }}>&mdash;</span>
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

      {/* ─── Categories Editor Modal ─────────────────────────────────────────── */}
      {showCategories && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowCategories(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 560,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.dark }}>
                &#9881; Behavior Categories
              </h2>
              <button
                onClick={() => setShowCategories(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                &#10005;
              </button>
            </div>

            {/* Current categories list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {editCategories.map((cat, idx) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#f8f8f5",
                    borderRadius: 10,
                    padding: "10px 14px",
                    border: "1px solid #eee",
                  }}
                >
                  {/* Reorder buttons */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <button
                      onClick={() => moveCategoryUp(idx)}
                      disabled={idx === 0}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: idx === 0 ? "default" : "pointer",
                        fontSize: 14,
                        color: idx === 0 ? "#ccc" : COLORS.dark,
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => moveCategoryDown(idx)}
                      disabled={idx === editCategories.length - 1}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: idx === editCategories.length - 1 ? "default" : "pointer",
                        fontSize: 14,
                        color: idx === editCategories.length - 1 ? "#ccc" : COLORS.dark,
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      &#9660;
                    </button>
                  </div>

                  {/* Editable name */}
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => updateCategoryName(idx, e.target.value)}
                    style={{
                      flex: 1,
                      border: "1px solid #d0d0d0",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.dark,
                      fontFamily: "inherit",
                    }}
                  />

                  {/* Type badge */}
                  <span style={{
                    background: cat.type === "scale" ? COLORS.accent : cat.type === "toggle" ? COLORS.secondary : COLORS.primary,
                    color: "white",
                    borderRadius: 6,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}>
                    {cat.type}
                  </span>

                  {/* No Points toggle */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      color: cat.noPoints ? COLORS.primary : "#bbb",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                    title="When enabled, this category is tracked but does not count toward the daily score"
                  >
                    <div
                      onClick={() => {
                        setEditCategories((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], noPoints: !next[idx].noPoints };
                          return next;
                        });
                      }}
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 9,
                        background: cat.noPoints ? COLORS.primary : "#ddd",
                        position: "relative",
                        transition: "background 0.2s",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "white",
                        position: "absolute",
                        top: 2,
                        left: cat.noPoints ? 16 : 2,
                        transition: "left 0.2s",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    No Pts
                  </label>

                  {/* Delete button */}
                  <button
                    onClick={() => deleteCategoryFromEditor(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: COLORS.red,
                      cursor: "pointer",
                      fontSize: 18,
                      padding: 0,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Add new category */}
            <div style={{
              background: "#f0f8ff",
              borderRadius: 10,
              padding: 16,
              border: `1px dashed ${COLORS.blue}`,
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 10 }}>
                Add Category
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 3 }}>Name</label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Homework"
                    style={{
                      width: "100%",
                      border: "1px solid #d0d0d0",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 14,
                      fontFamily: "inherit",
                      color: COLORS.dark,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ minWidth: 100 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 3 }}>Type</label>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as "scale" | "toggle" | "arrival")}
                    style={{
                      width: "100%",
                      border: "1px solid #d0d0d0",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 14,
                      fontFamily: "inherit",
                      color: COLORS.dark,
                      background: "white",
                    }}
                  >
                    <option value="scale">Scale (0-3)</option>
                    <option value="toggle">Toggle</option>
                    <option value="arrival">Arrival</option>
                  </select>
                </div>
                {(newCatType === "toggle" || newCatType === "arrival") && (
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#666", marginBottom: 3 }}>
                      Options (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={newCatOptions}
                      onChange={(e) => setNewCatOptions(e.target.value)}
                      placeholder={newCatType === "toggle" ? "Yes, No" : "On Time, L, L/E"}
                      style={{
                        width: "100%",
                        border: "1px solid #d0d0d0",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 14,
                        fontFamily: "inherit",
                        color: COLORS.dark,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={addNewCategory}
                  disabled={!newCatName.trim()}
                  style={{
                    background: newCatName.trim() ? COLORS.blue : "#ccc",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: newCatName.trim() ? "pointer" : "default",
                    height: 34,
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCategories(false)}
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
                onClick={saveCategories}
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
                Save Categories
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Customize Modal ────────────────────────────────────────────────── */}
      {showCustomize && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowCustomize(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 520,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.dark }}>
                🎨 Customize
              </h2>
              <button
                onClick={() => setShowCustomize(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                &#10005;
              </button>
            </div>

            {/* Color Theme */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark, marginBottom: 8 }}>
                Color Theme
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {Object.entries(THEMES).map(([key, theme]) => (
                  <button
                    key={key}
                    onClick={() => savePreferences({ ...prefs, theme: key })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: (prefs.theme ?? "default") === key ? "#f0f8ff" : "#fafafa",
                      border: (prefs.theme ?? "default") === key ? `2px solid ${theme.swatch[0]}` : "1px solid #e0e0e0",
                      borderRadius: 8,
                      padding: "8px 10px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", gap: 3 }}>
                      {theme.swatch.map((color, i) => (
                        <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: color }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>{theme.name}</span>
                    {(prefs.theme ?? "default") === key && <span style={{ marginLeft: "auto", fontSize: 14 }}>&#10003;</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Font */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark, marginBottom: 8 }}>
                Font
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FONTS.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => savePreferences({ ...prefs, font: font.id })}
                    style={{
                      background: (prefs.font ?? "nunito") === font.id ? C.dark : "#f0f0f0",
                      color: (prefs.font ?? "nunito") === font.id ? "white" : "#333",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: font.value,
                      cursor: "pointer",
                    }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Icon */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark, marginBottom: 8 }}>
                Progress Icon
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STAR_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => savePreferences({ ...prefs, starIcon: icon })}
                    style={{
                      background: (prefs.starIcon ?? "⭐") === icon ? C.dark : "#f0f0f0",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 20,
                      cursor: "pointer",
                      outline: (prefs.starIcon ?? "⭐") === icon ? `2px solid ${C.primary}` : "none",
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Confetti Toggle */}
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark }}>
                  Confetti
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>Celebrate when students hit top zone</div>
              </div>
              <div
                onClick={() => savePreferences({ ...prefs, confetti: prefs.confetti === false ? true : false })}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: prefs.confetti !== false ? C.secondary : "#ccc",
                  position: "relative",
                  transition: "background 0.2s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 2,
                  left: prefs.confetti !== false ? 22 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>

            {/* Compact Mode Toggle */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark }}>
                  Compact Mode
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>Reduce row height in the scoring grid</div>
              </div>
              <div
                onClick={() => savePreferences({ ...prefs, compact: !prefs.compact })}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: prefs.compact ? C.secondary : "#ccc",
                  position: "relative",
                  transition: "background 0.2s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 2,
                  left: prefs.compact ? 22 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>

            {/* Done Button */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCustomize(false)}
                style={{
                  background: C.secondary,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 28px",
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

      {/* ─── School Team Modal ──────────────────────────────────────────────────── */}
      {showStaffSync && (
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
          onClick={(e) => { if (e.target === e.currentTarget) setShowStaffSync(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 32,
            width: "90%",
            maxWidth: 440,
            textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#9729;&#65039;</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: COLORS.dark }}>
              School Team
            </h2>
            <div style={{
              background: COLORS.blue,
              color: "white",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              display: "inline-block",
              marginBottom: 16,
            }}>
              Coming Soon
            </div>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
              Cloud sync between teachers is being developed. This will allow staff at your school to share student behavior data, coordinate on interventions, and view cross-period reports — all in real time.
            </p>
            <button
              onClick={() => setShowStaffSync(false)}
              style={{
                background: COLORS.blue,
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import { useSchedules } from "@/src/lib/use-schedules";
import { getPeriodType } from "@/src/lib/schedules-schema";
import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import { syncToGoogleSheets, getValidGoogleToken } from "./sheetsSync";
import ManageLinksModal from "@/src/components/ManageLinksModal";
import { fireAuditEvent } from "@/src/lib/audit-event-client";

const ChartViews = dynamic(() => import("./ChartViews"), { ssr: false });

// ─── Colors & Constants ───────────────────────────────────────────────────────

// Sure Step Education design tokens (see sure-step-design-system.md).
// primary/secondary collapse onto the single green signature accent; dark is
// ink navy; red/gold/green/blue map onto the §2 status scale so the standing
// zones (support → working → track → exceptional) match the brand exactly.
const COLORS = {
  primary: "#0F6E56",   // forest — primary CTAs (company aesthetic)
  secondary: "#1D9E75", // teal — signature accent
  accent: "#EF9F27",    // amber — warm highlight
  dark: "#1a1a2e",      // navy — headers, headings, dark text
  red: "#dd6b4d",       // status-support — "Needs Support"
  gold: "#e3a23c",      // status-working — "Working On It"
  green: "#4fa07e",     // status-track — "On Track"
  blue: "#5e97c4",      // status-exceptional — "Exceptional"
};

const THEMES: Record<string, { name: string; header: string; primary: string; secondary: string; accent: string; bg: string; swatch: string[] }> = {
  default: { name: "Sure Step", header: "#1a1a2e", primary: "#0F6E56", secondary: "#1D9E75", accent: "#EF9F27", bg: "#F7F5F0", swatch: ["#1a1a2e", "#1D9E75", "#EF9F27"] },
  classic: { name: "DailyWins", header: "#2c3e50", primary: "#e07850", secondary: "#3a7c6a", accent: "#f0b647", bg: "#f5f5f0", swatch: ["#2c3e50", "#e07850", "#3a7c6a"] },
  steelBlue: { name: "Steel Blue", header: "#34495e", primary: "#2980b9", secondary: "#27ae60", accent: "#f39c12", bg: "#eef3f7", swatch: ["#34495e", "#2980b9", "#27ae60"] },
  sage: { name: "Sage Green", header: "#2d5a3d", primary: "#8e6b47", secondary: "#5d8a68", accent: "#d4a76a", bg: "#eff5f1", swatch: ["#2d5a3d", "#5d8a68", "#8e6b47"] },
  lavender: { name: "Lavender", header: "#4a3b6b", primary: "#8e5ea2", secondary: "#5b8a72", accent: "#d4a05a", bg: "#f3f0f7", swatch: ["#4a3b6b", "#8e5ea2", "#5b8a72"] },
  rose: { name: "Rose", header: "#523a85", primary: "#e84393", secondary: "#00b894", accent: "#fdcb6e", bg: "#f7f0f4", swatch: ["#523a85", "#e84393", "#00b894"] },
};

// Display serif for headings — design system's editorial voice (§5).
const DISPLAY_FONT = "'DM Serif Display', Georgia, serif";

const STAR_ICONS = ["⭐", "🏆", "🎯"];

// Render an emoji to a PNG data URL so it can be embedded in a jsPDF — jsPDF's
// core fonts can't draw emoji as text. Returns "" if canvas isn't available.
function emojiPngDataUrl(emoji: string, px = 96): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.font = `${Math.floor(px * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, px / 2, px / 2);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

// Draw one goal's progress as a compact vertical-bar chart inside a bordered
// card — clean enough for an IEP/meeting and legible in black & white (bar HEIGHT
// + a printed % carry the meaning; color is a bonus). A faint band marks the
// 80–100% "on-target" zone. Null buckets are skipped (no data).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawGoalChart(doc: any, x: number, y: number, w: number, h: number, title: string, points: { label: string; pct: number | null }[], avgPct: number | null) {
  // Card
  doc.setDrawColor(222, 226, 230);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.2, 2.2, "FD");

  // Title + average badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(44, 62, 80);
  doc.text(title, x + 4, y + 6.5);
  doc.setFont("helvetica", "normal");
  if (avgPct != null) {
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(`avg ${avgPct}%`, x + w - 4, y + 6.5, { align: "right" });
  }

  // Plot area
  const padL = 9;
  const padR = 4;
  const padT = 11;
  const padB = 7.5;
  const px = x + padL;
  const py = y + padT;
  const pw = w - padL - padR;
  const ph = h - padT - padB;

  // On-target band (top 20%) — faint
  doc.setFillColor(235, 243, 239);
  doc.rect(px, py, pw, ph * 0.2, "F");

  // Gridlines + y labels at 0/50/100
  doc.setFontSize(6);
  for (const g of [0, 50, 100]) {
    const gy = py + ph * (1 - g / 100);
    doc.setDrawColor(232, 234, 236);
    doc.setLineWidth(0.15);
    doc.line(px, gy, px + pw, gy);
    doc.setTextColor(165, 170, 175);
    doc.text(String(g), x + padL - 7, gy + 1.4);
  }

  // Bars
  const n = points.length;
  const slot = n > 0 ? pw / n : pw;
  const barW = Math.max(2, Math.min(8, slot * 0.62));
  points.forEach((p, i) => {
    const cx = px + slot * i + slot / 2;
    doc.setFontSize(5.6);
    doc.setTextColor(150, 150, 150);
    doc.text(p.label, cx, py + ph + 4, { align: "center" });
    if (p.pct == null) return;
    const bh = Math.max(0.3, ph * (p.pct / 100));
    const by = py + ph - bh;
    doc.setFillColor(29, 158, 117);
    doc.rect(cx - barW / 2, by, barW, bh, "F");
    doc.setFontSize(6);
    doc.setTextColor(70, 70, 70);
    doc.text(String(p.pct), cx, by - 1.3, { align: "center" });
  });

  // Baseline
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.line(px, py + ph, px + pw, py + ph);
}

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
  period: string | null; // null = legacy flat note (shows as "General")
  date?: string; // note_date, used in history view
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
  // Period 0 (zero-period prep block before school) is hidden by default —
  // teachers almost never collect behavior data before school. Toggle on per
  // teacher if they actually score a 0-period class.
  showPeriodZero?: boolean;
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

interface PeriodSlot {
  label: string;
  start: string;
  end: string;
}

// ─── Bell Schedules ───────────────────────────────────────────────────────────
//
// Bell schedules live in public.schools.schedules (JSONB) and load via
// useSchedules() keyed by the teacher's ASSIGNED school name. There is no
// hardcoded school list and no fallback: a teacher's school is set by their
// site admin (via the invite / role assignment), not chosen in the dashboard.
// Before the DB read returns — or if it fails — the modal shows no variants
// rather than stale data that would mislead users.

// ─── Score Helpers ────────────────────────────────────────────────────────────

// Scores: Record<period label, Record<category id, point value | null>>
type PeriodScores = Record<string, number | null>;
type AllScores = Record<string, PeriodScores>;
type AbsentStatus = "present" | "unexcused" | "excused";
type PeriodAbsentMap = Record<string, AbsentStatus>;

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
    const raw = periodScores[cat.id];
    pts += raw != null
      ? (cat.type === "arrival" ? getPointValue(cat, raw as number) : raw as number)
      : 0;
  }
  return pts;
}

function calculateMaxPoints(categories: Category[]): number {
  return categories.reduce((sum, cat) => cat.noPoints ? sum : sum + cat.maxPoints, 0);
}

function calculateProgress(scores: AllScores, categories: Category[], periodAbsent?: PeriodAbsentMap): { earned: number; possible: number; pct: number } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { earned: 0, possible: 0, pct: 0 };
  const maxPerPeriod = calculateMaxPoints(categories);
  let earned = 0;
  let countedPeriods = 0;
  for (const [label, ps] of entries) {
    const status = periodAbsent?.[label] ?? "present";
    if (status === "excused") continue; // excused: remove from denominator entirely
    countedPeriods++;
    if (status === "unexcused") continue; // unexcused: 0 earned, but still counts in denominator
    earned += calculatePeriodPoints(ps, categories);
  }
  const possible = countedPeriods * maxPerPeriod;
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
  if (cat.type === "arrival") {
    // arrival state holds the option INDEX (see adaeb5f); first option is best.
    return 0;
  }
  // toggle: state holds pointValue; default to maxPoints (first/best option)
  return cat.maxPoints;
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

// ─── Mobile Detection ─────────────────────────────────────────────────────────

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
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
  // The teacher's school is set from their assignment (profile.school_name) when
  // the profile loads — not chosen in the dashboard. See the profile-load effect.
  const [selectedSchool, setSelectedSchool] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<string>("");
  const [lunchPref, setLunchPref] = useState<"1st" | "2nd">(() => {
    if (typeof window === "undefined") return "1st";
    return (localStorage.getItem("dailywins_lunch") as "1st" | "2nd") || "1st";
  });

  const schedulesForSchool = useSchedules(supabase, selectedSchool || null, {});
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAddStudents, setShowAddStudents] = useState(false);
  const [addStudentsText, setAddStudentsText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteShared, setNoteShared] = useState(false);
  const [inlineNotePeriod, setInlineNotePeriod] = useState<string | null>(null);
  const [inlineNoteText, setInlineNoteText] = useState("");
  const [inlineNoteShared, setInlineNoteShared] = useState(false);
  const [notesTab, setNotesTab] = useState<"today" | "history">("today");
  const [noteHistory, setNoteHistory] = useState<StudentNote[]>([]);
  const [noteHistoryLoading, setNoteHistoryLoading] = useState(false);
  const [noteHistorySearch, setNoteHistorySearch] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [activeView, setActiveView] = useState<"entry" | "weekly" | "monthly" | "annual">("entry");
  const [mobilePeriodIdx, setMobilePeriodIdx] = useState(0);
  const isMobile = useIsMobile(768);
  const [showCategories, setShowCategories] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [isSiteAdmin, setIsSiteAdmin] = useState(false);
  const [isFounder, setIsFounder] = useState(false);

  useEffect(() => {
    const schoolId = teacher?.school_id;
    if (!schoolId) {
      setIsSiteAdmin(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_school_admin", { target_school_id: schoolId });
      if (cancelled) return;
      setIsSiteAdmin(!error && data === true);
    })();
    return () => { cancelled = true; };
  }, [teacher?.school_id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("has_role", { p_role: "founder" });
      if (cancelled) return;
      setIsFounder(!error && data === true);
    })();
    return () => { cancelled = true; };
  }, []);
  const [prefs, setPrefs] = useState<Preferences>({});
  const [demoBusy, setDemoBusy] = useState<"seed" | "wipe" | null>(null);
  const [demoMessage, setDemoMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [streak, setStreak] = useState(0);
  const [trendPct, setTrendPct] = useState<number | null>(null);
  const [periodAbsent, setPeriodAbsent] = useState<PeriodAbsentMap>({});
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
  const activeFont = "'DM Sans', system-ui, sans-serif";
  const starIcon = prefs.starIcon ?? "⭐";
  const confettiEnabled = prefs.confetti !== false;

  useEffect(() => {
    const keys = Object.keys(schedulesForSchool);
    if (keys.includes(selectedSchedule)) return;
    setSelectedSchedule(keys[0] ?? "");
  }, [schedulesForSchool, selectedSchedule]);

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

      // Resolve the teacher profile through RLS so act-as sessions land on the
      // TARGET's row (effective_user_id() != auth.uid() during a session).
      // ensure_teacher_exists takes p_auth_id as an explicit parameter, so
      // passing u.id always returns the actor's row — that's the wrong lens
      // while act-as'd. The RLS-gated SELECT on teachers uses
      // effective_user_id() and resolves correctly in both cases.
      //
      // Note: the SELECT returns the raw teachers row (id, school_id, etc.),
      // while TeacherProfile uses teacher_id + school_name (the shape
      // ensure_teacher_exists returns). Map the row + join schools.name to
      // match.
      const { data: existingTeacher } = await supabase
        .from("teachers")
        .select("id, school_id, full_name, email, categories, preferences, deactivated_at, schools(name)")
        .maybeSingle();

      // Deactivated teacher: block access mid-session too, not just at login.
      if (existingTeacher?.deactivated_at) {
        router.replace("/access-denied");
        setLoading(false);
        return;
      }

      let profile: TeacherProfile;

      if (existingTeacher) {
        const schoolName =
          (existingTeacher.schools as { name?: string } | null)?.name ?? "";
        profile = {
          teacher_id: existingTeacher.id as string,
          school_id: existingTeacher.school_id as string,
          school_name: schoolName,
          full_name: existingTeacher.full_name as string,
          email: existingTeacher.email as string,
          categories: (existingTeacher.categories as Category[]) ?? [],
          preferences: (existingTeacher.preferences as Preferences | null) ?? undefined,
        };
      } else {
        // First-time provisioning path: actor has no teachers row yet. Call
        // ensure_teacher_exists to provision them. Cannot reach this branch
        // while act-as'd (the target must already be a Teacher to be a valid
        // act-as target — enforced upstream in canActAs()).
        const { data, error } = await supabase.rpc("ensure_teacher_exists", {
          p_auth_id: u.id,
          p_email: u.email ?? "",
          p_full_name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "Teacher",
        });

        if (error) {
          const isPendingAccessError =
            error?.message?.toLowerCase().includes("no approved access request") ||
            error?.message?.toLowerCase().includes("not provisioned") ||
            error?.code === "insufficient_privilege" ||
            error?.code === "42501";

          if (isPendingAccessError) {
            // Route through the role-aware resolver: a genuinely pending teacher
            // still ends at /pending, but an admin account (no teacher row) goes
            // to their admin home instead of looping /dashboard↔/pending.
            window.location.href = "/auth/home";
            return;
          }

          console.error("Failed to ensure teacher:", error);
          setLoading(false);
          return;
        }

        profile = data as TeacherProfile;
      }

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
      // The school is determined by the teacher's assignment, not a picker.
      setSelectedSchool(profile.school_name || "");

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

  // ─── Demo Mode ─────────────────────────────────────────────────────────────

  const demoStudentCount = dbStudents.filter((s) => s.display_name.startsWith("[DEMO] ")).length;

  const runDemoAction = async (
    kind: "seed" | "wipe",
    formatSuccess: (body: Record<string, number>) => string,
    formatError: (msg: string) => string
  ) => {
    setDemoBusy(kind);
    setDemoMessage(null);
    try {
      const res = await fetch(`/api/demo/${kind}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setDemoMessage({ success: true, text: formatSuccess(body) });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDemoMessage({ success: false, text: formatError(msg) });
      setDemoBusy(null);
    }
  };

  const handleLoadDemo = () =>
    runDemoAction(
      "seed",
      (b) => `Demo data loaded — ${b.studentsCreated} students, ${b.scoresCreated} scores. Reloading…`,
      (msg) => `Failed to load demo data: ${msg}`
    );

  const handleWipeDemo = () => {
    setShowWipeConfirm(false);
    return runDemoAction(
      "wipe",
      (b) => `Wiped ${b.studentsDeleted} demo student${b.studentsDeleted === 1 ? "" : "s"}. Reloading…`,
      (msg) => `Failed to wipe demo data: ${msg}`
    );
  };

  // ─── Confetti Trigger ───────────────────────────────────────────────────────

  const { pct } = calculateProgress(scores, categories, periodAbsent);
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

  const activePeriods: PeriodSlot[] = selectedSchool && schedulesForSchool && Object.keys(schedulesForSchool).length > 0
    ? (schedulesForSchool[selectedSchedule] ?? schedulesForSchool[Object.keys(schedulesForSchool)[0]]).periods
    : PERIODS.map((p) => ({ label: p, start: "", end: "" }));

  // A schedule has split lunch if it contains both "Period 4" and "Period 5"
  const hasSplitLunch = activePeriods.some(p => p.label === "Period 4") && activePeriods.some(p => p.label === "Period 5");

  const trackablePeriods = activePeriods.filter((p) => {
    // Skip break periods (lunch, passing, nutrition) and non_student blocks (staff-only, senior-only).
    // Falls back to label-matching for legacy data without a type field, so existing rows keep working.
    if (getPeriodType(p) !== "class") return false;
    if (p.label === "Lunch" || p.label === "Rally") return false;
    // Period 0 = before-school prep block; hidden unless the teacher opts in.
    if (p.label === "Period 0" && !prefs.showPeriodZero) return false;
    if (hasSplitLunch) {
      if (lunchPref === "1st" && p.label === "Period 4") return false;
      if (lunchPref === "2nd" && p.label === "Period 5") return false;
    }
    return true;
  });

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
    const newAbsent: PeriodAbsentMap = {};
    for (const p of trackablePeriods) {
      newScores[p.label] = makeEmptyPeriodScores(categories);
    }

    if (!error && data) {
      for (const row of data) {
        const label = periodNumberToLabel(row.period as number);
        if (label in newScores) {
          // Read the scores JSONB column
          const dbScores = row.scores as Record<string, unknown> | null;
          if (dbScores) {
            // Read _absent status (backward compat: true → "unexcused")
            if (dbScores._absent === true || dbScores._absent === "unexcused") {
              newAbsent[label] = "unexcused";
            } else if (dbScores._absent === "excused") {
              newAbsent[label] = "excused";
            }
            for (const cat of categories) {
              if (cat.id in dbScores) {
                newScores[label][cat.id] = dbScores[cat.id] as number | null;
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
    setPeriodAbsent(newAbsent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, trackablePeriods.length, categories]);

  // ─── Notes Loading ──────────────────────────────────────────────────────────

  const loadNotes = useCallback(async (studentId: string, date: string) => {
    if (!teacher) return;
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("student_id", studentId)
      .eq("note_date", date)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setNotes(data.map((n) => ({
        id: n.id as string,
        text: n.content as string,
        shared: !(n.is_private as boolean),
        timestamp: new Date(n.created_at as string).toLocaleString(),
        period: (n.period as string | null) ?? null,
      })));
    }
  }, [teacher, supabase]);

  // ─── Trigger Score + Note Load ──────────────────────────────────────────────

  useEffect(() => {
    setPeriodAbsent({}); // Reset absent state on student/date change
    if (selectedStudentId && teacher) {
      loadScores(selectedStudentId, selectedDate);
      loadNotes(selectedStudentId, selectedDate);
    } else {
      const initial: AllScores = {};
      for (const p of trackablePeriods) {
        initial[p.label] = makeEmptyPeriodScores(categories);
      }
      setScores(initial);
      setNotes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, selectedDate, selectedSchool, selectedSchedule, lunchPref, teacher]);

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
    // Sheets sync disabled May 2026 — EGUSD blocks Drive/Sheets access from teacher devices. PDF exports cover reporting needs instead.
    const SHEETS_SYNC_DISABLED = true;
    if (SHEETS_SYNC_DISABLED) return;
    if (!teacher || !selectedStudentId || !selectedStudent) return;

    // Check if we have any Google token (will auto-refresh if expired)
    const hasToken = googleAccessToken || localStorage.getItem("dailywins_google_token");
    if (!hasToken) return; // No token at all — skip silently

    setSyncStatus("syncing");
    const sharedNotes = notes.filter((n) => n.shared).map((n) => n.period ? `[${n.period}] ${n.text}` : n.text);

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

  const saveScoresToDb = useCallback(async (allScores: AllScores, absentMap?: PeriodAbsentMap) => {
    if (!teacher || !selectedStudentId) return;
    const absMap = absentMap ?? periodAbsent;

    const upserts = trackablePeriods
      .map((slot) => {
        const ps = allScores[slot.label];
        if (!ps) return null;
        // Build the scores JSONB object
        const scoresJson: Record<string, unknown> = {};
        for (const cat of categories) {
          scoresJson[cat.id] = ps[cat.id] ?? null;
        }
        // Include absent status if not present
        const status = absMap[slot.label];
        if (status && status !== "present") {
          scoresJson._absent = status;
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
      // Audit: server-side endpoint silently no-ops unless caller is act-as'd.
      fireAuditEvent({
        action: "behavior_scores.save",
        target_table: "behavior_scores",
        after: {
          student_id: selectedStudentId,
          score_date: selectedDate,
          row_count: upserts.length,
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, selectedStudentId, selectedDate, trackablePeriods.length, categories, scheduleSheetSync, periodAbsent]);

  // ─── Per-Period Absent Cycling ──────────────────────────────────────────────

  const cycleAbsent = (periodLabel: string) => {
    setPeriodAbsent((prev) => {
      const current = prev[periodLabel] ?? "present";
      const next: AbsentStatus = current === "present" ? "unexcused" : current === "unexcused" ? "excused" : "present";
      const updated = { ...prev, [periodLabel]: next };
      // Clear scores for unexcused periods (they earn 0)
      if (next === "unexcused") {
        setScores((prevScores) => {
          const cleared = { ...prevScores, [periodLabel]: makeEmptyPeriodScores(categories) };
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => saveScoresToDb(cleared, updated), 500);
          return cleared;
        });
      } else {
        // Save to persist the absent status change
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => saveScoresToDb(scores, updated), 500);
      }
      return updated;
    });
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

  const handleLunchPref = (pref: "1st" | "2nd") => {
    setLunchPref(pref);
    localStorage.setItem("dailywins_lunch", pref);
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

  // Fill one PERIOD (a row) with the standard student defaults — triggered by
  // clicking the period title / its ⚡. Horizontal counterpart to quickFillAll.
  const quickFillPeriod = (periodLabel: string) => {
    setScores((prev) => {
      const ps: PeriodScores = { ...(prev[periodLabel] ?? {}) };
      for (const cat of categories) {
        ps[cat.id] = quickFillDefault(cat);
      }
      const updated = { ...prev, [periodLabel]: ps };
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
    for (const s of newStudents) {
      fireAuditEvent({
        action: "student.create",
        target_table: "students",
        target_id: s.id,
        after: { display_name: s.display_name, school_id: s.school_id },
      });
    }

    if (!selectedStudentId && newStudents.length > 0) {
      setSelectedStudentId(newStudents[0].id);
    }
    setAddStudentsText("");
    setShowAddStudents(false);
  };

  // ─── Notes ──────────────────────────────────────────────────────────────────

  const handleAddNote = async (text: string, shared: boolean, period: string | null) => {
    if (!text.trim() || !teacher || !selectedStudentId) return;

    const { data, error } = await supabase
      .from("notes")
      .insert({
        student_id: selectedStudentId,
        teacher_id: teacher.teacher_id,
        note_date: selectedDate,
        content: text.trim(),
        is_private: !shared,
        period: period,
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
      period: (data.period as string | null) ?? null,
    };
    setNotes((prev) => [...prev, note]);
    fireAuditEvent({
      action: "note.create",
      target_table: "notes",
      target_id: data.id as string,
      after: {
        student_id: selectedStudentId,
        is_private: !shared,
        period: period,
      },
    });
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete note:", error);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    fireAuditEvent({
      action: "note.delete",
      target_table: "notes",
      target_id: id,
    });
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
      return;
    }
    fireAuditEvent({
      action: "note.visibility_change",
      target_table: "notes",
      target_id: id,
      before: { is_private: currentlyShared },
      after: { is_private: !newShared },
    });
  };

  const loadNoteHistory = async () => {
    if (!teacher || !selectedStudentId) return;
    setNoteHistoryLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("student_id", selectedStudentId)
      .order("note_date", { ascending: false })
      .order("created_at", { ascending: true });

    if (!error && data) {
      setNoteHistory(data.map((n: Record<string, unknown>) => ({
        id: n.id as string,
        text: n.content as string,
        shared: !(n.is_private as boolean),
        timestamp: new Date(n.created_at as string).toLocaleString(),
        period: (n.period as string | null) ?? null,
        date: n.note_date as string,
      })));
    }
    setNoteHistoryLoading(false);
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

  // Weekly / Monthly progress report: one small line chart per goal (category) \u2014
  // % of target met over time \u2014 so a team can review progress goal-by-goal.
  // Black-&-white safe: each goal is a vertical-bar card (see drawGoalChart).
  const generateTrendPDF = async (mode: "week" | "month") => {
    if (!teacher || !selectedStudentId) {
      alert("Select a student first.");
      return;
    }
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Time buckets + fetch range. Week \u2192 one bucket per weekday (Mon\u2013Fri);
    // Month \u2192 one bucket per calendar month across the months that have data.
    const base = new Date(selectedDate + "T12:00:00");
    const buckets: { label: string; start: string; end: string }[] = [];
    let rangeStart: string;
    let rangeEnd: string;
    let rangeLabel: string;
    if (mode === "week") {
      // Multi-week view: fetch ~8 weeks ending with the selected week. Per-week
      // buckets are built AFTER the fetch (below), from the first week with data.
      const selMon = new Date(base);
      selMon.setDate(base.getDate() - ((base.getDay() + 6) % 7));
      const selFri = new Date(selMon);
      selFri.setDate(selMon.getDate() + 4);
      const wideMon = new Date(selMon);
      wideMon.setDate(selMon.getDate() - 7 * 7);
      rangeStart = formatDate(wideMon);
      rangeEnd = formatDate(selFri);
      rangeLabel = "";
    } else {
      // Multi-month view: fetch a wide ~12-month window ending with the selected
      // month. The per-month buckets are built AFTER the fetch (below) so we only
      // plot months from the first one that actually has data.
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 12);
      const wideStart = new Date(base.getFullYear(), base.getMonth() - 11, 1, 12);
      rangeStart = formatDate(wideStart);
      rangeEnd = formatDate(end);
      rangeLabel = "";
    }

    const { data: scoreRows } = await supabase
      .from("behavior_scores")
      .select("score_date,scores,arrival,compliance,social,on_task,phone_away")
      .eq("student_id", selectedStudentId)
      .eq("teacher_id", teacher.teacher_id)
      .gte("score_date", rangeStart)
      .lte("score_date", rangeEnd);
    const data = scoreRows ?? [];

    // Week mode: one bucket per week (Mon–Fri), from the first week with data
    // (capped to ~8 weeks back) through the selected week.
    if (mode === "week") {
      const selMon = new Date(base);
      selMon.setDate(base.getDate() - ((base.getDay() + 6) % 7));
      const minAllowedMon = new Date(selMon);
      minAllowedMon.setDate(selMon.getDate() - 7 * 7);
      let firstMon = selMon;
      if (data.length > 0) {
        let minSd = data[0].score_date as string;
        for (const r of data) if ((r.score_date as string) < minSd) minSd = r.score_date as string;
        const md = new Date(minSd + "T12:00:00");
        const mdMon = new Date(md);
        mdMon.setDate(md.getDate() - ((md.getDay() + 6) % 7));
        firstMon = mdMon < minAllowedMon ? minAllowedMon : mdMon;
      }
      const cur = new Date(firstMon);
      while (cur <= selMon) {
        const wkMon = new Date(cur);
        const wkFri = new Date(cur);
        wkFri.setDate(cur.getDate() + 4);
        buckets.push({ label: `${wkMon.getMonth() + 1}/${wkMon.getDate()}`, start: formatDate(wkMon), end: formatDate(wkFri) });
        cur.setDate(cur.getDate() + 7);
      }
      rangeLabel = buckets.length > 1 ? `Weeks of ${buckets[0].label} – ${buckets[buckets.length - 1].label}` : `Week of ${buckets[0]?.start ?? rangeStart}`;
    }

    // Month mode: one bucket per calendar month, from the first month that has
    // data (capped to ~12 months back) through the selected month. Months with no
    // data become gaps in the line.
    if (mode === "month") {
      const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const lastMonth = new Date(base.getFullYear(), base.getMonth(), 1, 12);
      const minAllowed = new Date(base.getFullYear(), base.getMonth() - 11, 1, 12);
      let firstMonth = lastMonth;
      if (data.length > 0) {
        let minSd = data[0].score_date as string;
        for (const r of data) if ((r.score_date as string) < minSd) minSd = r.score_date as string;
        const md = new Date(minSd + "T12:00:00");
        firstMonth = new Date(md.getFullYear(), md.getMonth(), 1, 12);
        if (firstMonth < minAllowed) firstMonth = minAllowed;
      }
      const crossYear = firstMonth.getFullYear() !== lastMonth.getFullYear();
      const cur = new Date(firstMonth);
      while (cur <= lastMonth) {
        const mS = new Date(cur.getFullYear(), cur.getMonth(), 1, 12);
        const mE = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 12);
        const lbl = SHORT_MONTHS[cur.getMonth()] + (crossYear ? ` '${String(cur.getFullYear()).slice(2)}` : "");
        buckets.push({ label: lbl, start: formatDate(mS), end: formatDate(mE) });
        cur.setMonth(cur.getMonth() + 1);
      }
      rangeLabel =
        buckets.length > 1
          ? `${SHORT_MONTHS[firstMonth.getMonth()]} ${firstMonth.getFullYear()} – ${SHORT_MONTHS[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`
          : base.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }

    // Points for one cell of a category (arrival stores an option index).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cellPoints = (row: any, cat: Category): number | null => {
      const s = row.scores as Record<string, number | null> | null;
      let raw: number | null | undefined = s ? s[cat.id] : undefined;
      if (raw == null && !s) {
        if (cat.id === "arrival") raw = row.arrival;
        else if (cat.id === "compliance") raw = row.compliance;
        else if (cat.id === "social") raw = row.social;
        else if (cat.id === "onTask") raw = row.on_task;
        else if (cat.id === "phoneAway") raw = row.phone_away == null ? null : row.phone_away ? cat.maxPoints : 0;
      }
      if (raw == null) return null;
      return cat.type === "arrival" ? getPointValue(cat, raw as number) : (raw as number);
    };

    // Per-goal series: % of target met for each bucket (null = no data \u2192 gap).
    const series = categories.map((cat) => {
      const pts = buckets.map((b) => {
        let sum = 0;
        let cnt = 0;
        for (const r of data) {
          const sd = r.score_date as string;
          if (sd < b.start || sd > b.end) continue;
          const p = cellPoints(r, cat);
          if (p == null) continue;
          const max = cat.maxPoints || 0;
          if (max <= 0) continue;
          sum += p / max;
          cnt += 1;
        }
        return { label: b.label, pct: cnt > 0 ? Math.round((sum / cnt) * 100) : null };
      });
      return { cat, pts };
    });

    // Header band (company navy)
    doc.setFillColor(26, 26, 46);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(`${mode === "week" ? "Weekly" : "Monthly"} Progress Report`, 14, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${selectedStudent || "Student"}   \u00b7   ${rangeLabel}`, 14, 19.5);
    const icon = emojiPngDataUrl(starIcon);
    if (icon) doc.addImage(icon, "PNG", pageW - 24, 7, 12, 12);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.text("% of target met over time, per goal \u2014 shaded band marks the 80\u2013100% on-target zone.", 14, 32);

    // Goal charts (vertical-bar cards), two per row.
    const cols = 2;
    const chartW = 91;
    const chartH = 50;
    const gapX = 5;
    const gapY = 6;
    const startX = 14;
    let curY = 38;
    for (let i = 0; i < series.length; i += cols) {
      if (curY + chartH > pageH - 16) {
        doc.addPage();
        curY = 16;
      }
      for (let c = 0; c < cols && i + c < series.length; c++) {
        const s = series[i + c];
        const valid = s.pts.filter((p) => p.pct != null).map((p) => p.pct as number);
        const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
        drawGoalChart(doc, startX + c * (chartW + gapX), curY, chartW, chartH, s.cat.name, s.pts, avg);
      }
      curY += chartH + gapY;
    }

    // Shared notes over the range
    const { data: noteRows } = await supabase
      .from("notes")
      .select("note_date,content,period,is_private")
      .eq("student_id", selectedStudentId)
      .eq("is_private", false)
      .gte("note_date", rangeStart)
      .lte("note_date", rangeEnd)
      .order("note_date", { ascending: true });
    const sharedNotes = noteRows ?? [];
    if (sharedNotes.length > 0) {
      if (curY + 16 > pageH - 16) { doc.addPage(); curY = 16; } else { curY += 4; }
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text("Teacher Notes", 14, curY);
      curY += 7;
      for (const n of sharedNotes) {
        if (curY > pageH - 16) { doc.addPage(); curY = 16; }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nn = n as any;
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`${nn.note_date}${nn.period ? " \u00b7 " + nn.period : ""}`, 14, curY);
        curY += 4.5;
        doc.setTextColor(44, 62, 80);
        const lines = doc.splitTextToSize(`\u2022 ${nn.content}`, 180);
        doc.text(lines, 18, curY);
        curY += lines.length * 4.5 + 1.5;
      }
    }

    doc.save(`DailyWins_${mode === "week" ? "Weekly" : "Monthly"}_${selectedStudent || "report"}_${rangeStart}.pdf`);
  };

  const generateWeeklyPDF = () => generateTrendPDF("week");
  const generateMonthlyPDF = () => generateTrendPDF("month");



  // ─── Derived Progress Values ────────────────────────────────────────────────

  const { earned, possible } = calculateProgress(scores, categories, periodAbsent);

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
            const isSelected = currentValue !== null && currentValue === optIdx;
            return (
              <button
                key={optLabel}
                onClick={() => updateScore(period, cat.id, isSelected ? null : optIdx)}
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

  // ─── Mobile-Sized Category Buttons ──────────────────────────────────────────

  const renderMobileCategoryButtons = (cat: Category, period: string, periodScores: PeriodScores) => {
    const currentValue = periodScores[cat.id];

    if (cat.type === "arrival") {
      return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {cat.options.map((optLabel, optIdx) => {
            const isSelected = currentValue !== null && currentValue === optIdx;
            return (
              <button
                key={optLabel}
                onClick={() => updateScore(period, cat.id, isSelected ? null : optIdx)}
                style={{
                  background: isSelected ? arrivalButtonColor(cat, optIdx) : "white",
                  color: isSelected ? "white" : "#444",
                  border: isSelected ? "1px solid transparent" : "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 44,
                  minWidth: 56,
                  flex: optLabel.length > 3 ? "1 1 auto" : "0 0 auto",
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

    if (cat.type === "scale") {
      return (
        <div style={{ display: "flex", gap: 8 }}>
          {cat.options.map((optLabel, optIdx) => {
            const optPoints = getPointValue(cat, optIdx);
            const isSelected = currentValue !== null && currentValue === optPoints;
            return (
              <button
                key={optLabel}
                onClick={() => updateScore(period, cat.id, isSelected ? null : optPoints)}
                style={{
                  background: isSelected ? scaleColor(optPoints) : "white",
                  color: isSelected ? "white" : "#444",
                  border: isSelected ? "1px solid transparent" : "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 10,
                  flex: 1,
                  minHeight: 44,
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

    return (
      <div style={{ display: "flex", gap: 8 }}>
        {cat.options.map((optLabel, optIdx) => {
          const optPoints = getPointValue(cat, optIdx);
          const isSelected = currentValue !== null && currentValue === optPoints &&
            optIdx === getOptionIndexForPoints(cat, currentValue);
          return (
            <button
              key={optLabel}
              onClick={() => updateScore(period, cat.id, isSelected ? null : optPoints)}
              style={{
                background: isSelected ? toggleButtonColor(optIdx) : "white",
                color: isSelected ? "white" : "#444",
                border: isSelected ? "1px solid transparent" : "1px solid rgba(0,0,0,0.12)",
                borderRadius: 10,
                flex: 1,
                minHeight: 44,
                padding: "12px 20px",
                fontSize: 14,
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

  const categoryTypeLabel = (cat: Category): string => {
    if (cat.type === "arrival") return "Attendance";
    if (cat.type === "scale") {
      const max = cat.maxPoints ?? 3;
      return `0-${max} scale`;
    }
    return cat.options.join(" / ");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const maxPerPeriod = calculateMaxPoints(categories);

  return (
    <>
      {/* Google Fonts: company aesthetic trio — DM Serif Display, DM Sans, DM Mono */}
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet" />
    <div style={{ minHeight: "100vh", background: activeTheme.bg, fontFamily: activeFont }}>
      <ConfettiCanvas active={showConfetti && confettiEnabled} />

      {/* Header — ink bar, green mark, Daily·Wins amber-half wordmark (design system §9) */}
      <header style={{ background: C.dark, boxShadow: "0 1px 2px rgba(22,38,61,0.06), 0 6px 16px rgba(22,38,61,0.07)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              background: C.secondary,
              width: 36,
              height: 32,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
            }}>
              DW
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
              <span style={{ color: "white" }}>Daily</span>
              <span style={{ color: C.accent }}>Wins</span>
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{user.email}</span>
            <button
              onClick={handleSignOut}
              style={{
                background: "transparent",
                color: "white",
                border: "1px solid rgba(255,255,255,0.35)",
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
            borderRadius: 12,
            padding: "40px 24px",
            textAlign: "center",
            marginBottom: 24,
            boxShadow: "0 1px 2px rgba(22,38,61,0.06), 0 6px 16px rgba(22,38,61,0.07)",
            border: `1px solid ${COLORS.dark}1a`,
            borderTop: `3px solid ${COLORS.secondary}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#127942;</div>
            <h2 style={{ fontFamily: DISPLAY_FONT, color: COLORS.dark, fontSize: 26, fontWeight: 500, margin: "0 0 8px" }}>
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

          {hasStudents && (
            <button
              onClick={() => setShowLinks(true)}
              style={{ borderRadius: 6, border: "1px solid #d0d0d0", padding: "5px 10px", fontSize: 13, fontWeight: 600, color: COLORS.dark, background: "white", height: 32, cursor: "pointer" }}
            >
              🔗 Links
            </button>
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
            onClick={() => { setNotesTab("today"); setShowNotes(true); }}
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
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 800, color: C.dark }}>
                <span>{starIcon}</span>
                <span>{`${earned} / ${possible} pts (${pct}%)`}</span>
              </div>
              <span style={{
                background: zoneColor(pct),
                color: "white",
                borderRadius: 6,
                padding: "2px 8px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.5,
              }}>
                {pct >= thresholds[2] ? "Exceptional" : pct >= thresholds[1] ? "On Track" : pct >= thresholds[0] ? "Working On It" : "Needs Support"}
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

        {/* Scoring Grid (Desktop) */}
        {hasStudents && activeView === "entry" && !isMobile && (
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
                  <th style={{ padding: "6px 4px", textAlign: "center", color: "white", fontSize: 10, fontWeight: 700, width: 28 }}>
                    &#128221;
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
                    </div>
                  </td>
                  {categories.map((cat) => (
                    <td key={cat.id} style={{ padding: "4px 4px" }}></td>
                  ))}
                  <td style={{ padding: "4px 4px", textAlign: "center", fontSize: 10, color: "#999" }}>&mdash;</td>
                  <td style={{ padding: "4px 4px" }}></td>
                </tr>
              </thead>
              <tbody>
                {trackablePeriods.map((slot, i) => {
                  const ps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
                  const absentStatus = periodAbsent[slot.label] ?? "present";
                  const isExcused = absentStatus === "excused";
                  const isUnexcused = absentStatus === "unexcused";
                  const isAbsentPeriod = isExcused || isUnexcused;
                  const pts = isAbsentPeriod ? 0 : calculatePeriodPoints(ps, categories);
                  const ptsHighThreshold = Math.round(maxPerPeriod * 0.8);
                  const ptsMidThreshold = Math.round(maxPerPeriod * 0.53);
                  return (
                    <tr
                      key={slot.label + i}
                      style={{
                        background: isExcused ? "#f0f0f0" : isUnexcused ? "#fef0ea" : i % 2 === 0 ? "#fafaf7" : "white",
                        borderTop: "1px solid #eee",
                        opacity: isExcused ? 0.5 : 1,
                      }}
                    >
                      <td style={{ padding: "4px 10px", fontWeight: 700, color: C.dark, fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button
                            onClick={() => cycleAbsent(slot.label)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 7,
                              border: "none",
                              fontSize: 10,
                              fontWeight: 800,
                              cursor: "pointer",
                              flexShrink: 0,
                              ...(isUnexcused
                                ? { background: COLORS.red, color: "white" }
                                : isExcused
                                ? { background: "#7f8c8d", color: "white" }
                                : { background: "#e8e8e8", color: "#bbb" }),
                            }}
                          >
                            {isUnexcused ? "UA" : isExcused ? "EA" : "\u2713"}
                          </button>
                          <div>
                            <button
                              type="button"
                              onClick={() => quickFillPeriod(slot.label)}
                              disabled={isAbsentPeriod}
                              title="Fill this period with standard scores"
                              style={{
                                background: "none",
                                border: "none",
                                padding: 0,
                                font: "inherit",
                                fontWeight: 700,
                                color: C.dark,
                                cursor: isAbsentPeriod ? "default" : "pointer",
                                textDecoration: isExcused ? "line-through" : "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {slot.label}
                              {!isAbsentPeriod && <span style={{ fontSize: 11 }}>&#9889;</span>}
                            </button>
                            {slot.start && (
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#999", marginTop: 1 }}>
                                {slot.start} &ndash; {slot.end}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {categories.map((cat) => (
                        <td key={cat.id} style={{ padding: "3px 4px", textAlign: "center", pointerEvents: isAbsentPeriod ? "none" : "auto" }}>
                          {isAbsentPeriod ? (
                            <span style={{ fontSize: 11, color: isUnexcused ? COLORS.red : "#bbb", fontWeight: 700 }}>
                              {isUnexcused ? "0" : "\u2014"}
                            </span>
                          ) : renderCategoryCell(cat, slot.label, ps)}
                        </td>
                      ))}

                      {/* Period Points */}
                      <td style={{
                        padding: "3px 6px",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: 14,
                        color: isExcused ? "#bbb" : isUnexcused ? COLORS.red : pts >= ptsHighThreshold ? COLORS.secondary : pts >= ptsMidThreshold ? COLORS.accent : COLORS.primary,
                      }}>
                        {isExcused ? "\u2014" : pts}
                      </td>

                      {/* Note Icon */}
                      <td style={{ padding: "2px 2px", textAlign: "center", position: "relative" }}>
                        {(() => {
                          const periodNoteCount = notes.filter((n) => n.period === slot.label).length;
                          return (
                            <>
                              <button
                                onClick={() => { setInlineNotePeriod(inlineNotePeriod === slot.label ? null : slot.label); setInlineNoteText(""); }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  fontSize: 14,
                                  padding: 2,
                                  position: "relative",
                                  opacity: periodNoteCount > 0 ? 1 : 0.3,
                                }}
                                title={periodNoteCount > 0 ? `${periodNoteCount} note(s)` : "Add note"}
                              >
                                {periodNoteCount > 0 ? "\uD83D\uDCDD" : "\uD83D\uDCAC"}
                                {periodNoteCount > 0 && (
                                  <span style={{
                                    position: "absolute",
                                    top: -2,
                                    right: -4,
                                    background: COLORS.primary,
                                    color: "white",
                                    borderRadius: "50%",
                                    width: 14,
                                    height: 14,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}>
                                    {periodNoteCount}
                                  </span>
                                )}
                              </button>
                              {inlineNotePeriod === slot.label && (
                                <div style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "100%",
                                  width: 260,
                                  background: "white",
                                  borderRadius: 10,
                                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                                  padding: 10,
                                  zIndex: 100,
                                  textAlign: "left",
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.dark, marginBottom: 6 }}>{slot.label} Notes</div>
                                  {notes.filter((n) => n.period === slot.label).map((note) => (
                                    <div key={note.id} style={{ fontSize: 11, color: COLORS.dark, padding: "3px 0", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                      <span style={{ lineHeight: 1.3 }}>{note.text}</span>
                                      <button onClick={() => handleDeleteNote(note.id)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, flexShrink: 0, marginLeft: 4 }}>&#10005;</button>
                                    </div>
                                  ))}
                                  <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                                    <input
                                      value={inlineNoteText}
                                      onChange={(e) => setInlineNoteText(e.target.value)}
                                      placeholder="Quick note..."
                                      autoFocus
                                      style={{ flex: 1, borderRadius: 6, border: "1px solid #d0d0d0", padding: "5px 8px", fontSize: 11, fontFamily: "inherit" }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && inlineNoteText.trim()) {
                                          handleAddNote(inlineNoteText, inlineNoteShared, slot.label);
                                          setInlineNoteText("");
                                        }
                                        if (e.key === "Escape") setInlineNotePeriod(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        if (inlineNoteText.trim()) {
                                          handleAddNote(inlineNoteText, inlineNoteShared, slot.label);
                                          setInlineNoteText("");
                                        }
                                      }}
                                      style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                                    >
                                      +
                                    </button>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                                    <div
                                      onClick={() => setInlineNoteShared(!inlineNoteShared)}
                                      style={{ width: 28, height: 16, borderRadius: 8, background: inlineNoteShared ? COLORS.secondary : "#ccc", position: "relative", cursor: "pointer" }}
                                    >
                                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white", position: "absolute", top: 2, left: inlineNoteShared ? 14 : 2, transition: "left 0.2s" }} />
                                    </div>
                                    <span style={{ fontSize: 10, color: "#999" }}>{inlineNoteShared ? "Shared" : "Private"}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Scoring Area (Mobile — Period Focus) */}
        {hasStudents && activeView === "entry" && isMobile && (() => {
          const activeIdx = Math.min(mobilePeriodIdx, Math.max(0, trackablePeriods.length - 1));
          const activeSlot = trackablePeriods[activeIdx];
          if (!activeSlot) return null;
          const ps = scores[activeSlot.label] ?? makeEmptyPeriodScores(categories);
          const status = periodAbsent[activeSlot.label] ?? "present";
          const isExcused = status === "excused";
          const isUnexcused = status === "unexcused";
          const isAbsentPeriod = isExcused || isUnexcused;
          const activePts = isAbsentPeriod ? 0 : calculatePeriodPoints(ps, categories);
          const periodNotes = notes.filter((n) => n.period === activeSlot.label);

          return (
            <div style={{ background: "#faf7f2", borderRadius: 12, padding: 8, marginTop: 4 }}>
              {/* Fill defaults + period selector */}
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={quickFillAll}
                  style={{
                    background: COLORS.secondary,
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    minHeight: 44,
                    width: "100%",
                    marginBottom: 8,
                  }}
                >
                  &darr; Fill all defaults
                </button>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 6,
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {trackablePeriods.map((slot, i) => {
                    const sps = scores[slot.label] ?? makeEmptyPeriodScores(categories);
                    const sStatus = periodAbsent[slot.label] ?? "present";
                    const sAbsent = sStatus !== "present";
                    const pPts = sAbsent ? 0 : calculatePeriodPoints(sps, categories);
                    const pPct = maxPerPeriod > 0 ? Math.round((pPts / maxPerPeriod) * 100) : 0;
                    const isActive = i === activeIdx;
                    return (
                      <button
                        key={slot.label + i}
                        onClick={() => setMobilePeriodIdx(i)}
                        style={{
                          flex: "0 0 auto",
                          minWidth: 100,
                          scrollSnapAlign: "start",
                          background: isActive ? "#1a1a1a" : "white",
                          color: isActive ? "white" : "#1a1a1a",
                          border: isActive ? "1px solid transparent" : "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          cursor: "pointer",
                          textAlign: "left",
                          minHeight: 64,
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{slot.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>
                          {sAbsent ? (sStatus === "unexcused" ? "UA" : "EA") : `${pPts}/${maxPerPeriod}`}
                        </div>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 2,
                            background: isActive ? "rgba(255,255,255,0.2)" : "#eee",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pPct}%`,
                              background: isActive ? "white" : zoneColor(pPct),
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active period card */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.06)",
                  padding: 16,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a1a", lineHeight: 1.1 }}>
                      {activeSlot.label}
                    </div>
                    {activeSlot.start && (
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                        {activeSlot.start} &ndash; {activeSlot.end}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: isExcused
                        ? "#bbb"
                        : isUnexcused
                        ? COLORS.red
                        : activePts >= Math.round(maxPerPeriod * 0.8)
                        ? COLORS.secondary
                        : activePts >= Math.round(maxPerPeriod * 0.53)
                        ? COLORS.accent
                        : COLORS.primary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isExcused ? "—" : `${activePts}/${maxPerPeriod}`}
                  </div>
                </div>

                {/* Attendance toggle */}
                <button
                  onClick={() => cycleAbsent(activeSlot.label)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: isUnexcused ? COLORS.red : isExcused ? "#7f8c8d" : "#f0f0f0",
                    color: isAbsentPeriod ? "white" : "#666",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    minHeight: 36,
                    marginBottom: 14,
                  }}
                >
                  {isUnexcused ? "Unexcused Absent" : isExcused ? "Excused Absent" : "✓ Present"}
                </button>

                {/* Category cards */}
                {!isAbsentPeriod && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          background: "#faf7f2",
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.06)",
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>{cat.name}</div>
                          <div style={{ fontSize: 11, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {categoryTypeLabel(cat)}
                          </div>
                        </div>
                        {renderMobileCategoryButtons(cat, activeSlot.label, ps)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div style={{ marginTop: 14 }}>
                  {periodNotes.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                      {periodNotes.map((note) => (
                        <div
                          key={note.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            background: "#faf7f2",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            color: "#444",
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ flex: 1 }}>{note.text}</span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 14, marginLeft: 8 }}
                          >
                            &#10005;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={inlineNotePeriod === activeSlot.label ? inlineNoteText : ""}
                    onChange={(e) => {
                      setInlineNotePeriod(activeSlot.label);
                      setInlineNoteText(e.target.value);
                    }}
                    onFocus={() => setInlineNotePeriod(activeSlot.label)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && inlineNoteText.trim()) {
                        e.preventDefault();
                        handleAddNote(inlineNoteText, inlineNoteShared, activeSlot.label);
                        setInlineNoteText("");
                      }
                    }}
                    placeholder="Anything to remember about this period…"
                    rows={2}
                    style={{
                      width: "100%",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.12)",
                      padding: "10px 12px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      resize: "vertical",
                      background: "white",
                      boxSizing: "border-box",
                    }}
                  />
                  {inlineNotePeriod === activeSlot.label && inlineNoteText.trim() && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        onClick={() => {
                          if (inlineNoteText.trim()) {
                            handleAddNote(inlineNoteText, inlineNoteShared, activeSlot.label);
                            setInlineNoteText("");
                          }
                        }}
                        style={{
                          background: COLORS.secondary,
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 14px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          minHeight: 36,
                        }}
                      >
                        Add note
                      </button>
                      <button
                        onClick={() => setInlineNoteShared(!inlineNoteShared)}
                        style={{
                          background: inlineNoteShared ? COLORS.secondary : "#eee",
                          color: inlineNoteShared ? "white" : "#666",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          minHeight: 36,
                        }}
                      >
                        {inlineNoteShared ? "Shared" : "Private"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Prev / Next */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => setMobilePeriodIdx(Math.max(0, activeIdx - 1))}
                  disabled={activeIdx === 0}
                  style={{
                    flex: 1,
                    background: "white",
                    color: activeIdx === 0 ? "#bbb" : "#1a1a1a",
                    border: "1px solid rgba(0,0,0,0.06)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: activeIdx === 0 ? "not-allowed" : "pointer",
                    minHeight: 44,
                  }}
                >
                  &larr; Previous period
                </button>
                <button
                  onClick={() => setMobilePeriodIdx(Math.min(trackablePeriods.length - 1, activeIdx + 1))}
                  disabled={activeIdx >= trackablePeriods.length - 1}
                  style={{
                    flex: 1,
                    background: "#1a1a1a",
                    color: activeIdx >= trackablePeriods.length - 1 ? "#666" : "white",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: activeIdx >= trackablePeriods.length - 1 ? "not-allowed" : "pointer",
                    minHeight: 44,
                  }}
                >
                  Next period &rarr;
                </button>
              </div>
            </div>
          );
        })()}

        {/* Legend Keys (entry view only) — Arrival cards + one Score Scale card + Toggle cards */}
        {activeView === "entry" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {/* Arrival & Attendance combined card */}
          {categories.filter((c) => c.type === "arrival").map((cat) => (
            <div key={cat.id} style={{ background: "white", borderRadius: 8, padding: "6px 10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: COLORS.dark, marginBottom: 5 }}>
                Arrival &amp; Attendance
              </div>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 6 }}>
                <div>
                  <span style={{ color: arrivalButtonColor(cat, 0), fontWeight: 700 }}>On Time</span>
                  <span style={{ color: "#888" }}> = full points</span>
                  <span style={{ color: "#ccc" }}> {"\u00B7"} </span>
                  <span style={{ color: arrivalButtonColor(cat, 1), fontWeight: 700 }}>L</span>
                  <span style={{ color: "#888" }}> (Late) = 0 pts</span>
                  <span style={{ color: "#ccc" }}> {"\u00B7"} </span>
                  <span style={{ color: arrivalButtonColor(cat, 2), fontWeight: 700 }}>L/E</span>
                  <span style={{ color: "#888" }}> = full pts</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: "#e8e8e8", color: "#bbb", fontSize: 10, fontWeight: 800 }}>{"\u2713"}</span>
                  <span style={{ fontSize: 12, color: "#555" }}><span style={{ fontWeight: 700 }}>Present</span> &mdash; normal scoring</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: COLORS.red, color: "white", fontSize: 10, fontWeight: 800 }}>UA</span>
                  <span style={{ fontSize: 12, color: "#555" }}><span style={{ fontWeight: 700 }}>Unexcused</span> &mdash; 0 pts, counts against %</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, background: "#7f8c8d", color: "white", fontSize: 10, fontWeight: 800 }}>EA</span>
                  <span style={{ fontSize: 12, color: "#555" }}><span style={{ fontWeight: 700 }}>Excused</span> &mdash; removed from total, no impact on %</span>
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
            onClick={generateMonthlyPDF}
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
            &#128197; Monthly PDF
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 8 }}>
          <a
            href="mailto:support@surestepeducation.com?subject=DailyWins%20feedback"
            style={{
              background: "#7C3AED",
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
              textDecoration: "none",
            }}
          >
            ✉️ Email support
          </a>
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
                          fireAuditEvent({
                            action: "student.delete",
                            target_table: "students",
                            target_id: s.id,
                            before: { display_name: s.display_name },
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

      <ManageLinksModal
        studentId={selectedStudentId}
        studentName={selectedStudent}
        open={showLinks}
        onClose={() => setShowLinks(false)}
      />

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
            maxWidth: 560,
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
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

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {(["today", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setNotesTab(tab); if (tab === "history" && noteHistory.length === 0) loadNoteHistory(); }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: notesTab === tab ? COLORS.dark : "#f0f0f0",
                    color: notesTab === tab ? "white" : COLORS.dark,
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "today" ? `Today (${selectedDate})` : "Note History"}
                </button>
              ))}
            </div>

            {notesTab === "today" && (<>
            {/* Notes organized by period */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {trackablePeriods.map((slot) => {
                const periodNotes = notes.filter((n) => n.period === slot.label);
                return (
                  <div key={slot.label} style={{ background: "#fafaf7", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: periodNotes.length > 0 ? 8 : 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>{slot.label}</div>
                      {periodNotes.length === 0 && (
                        <span style={{ fontSize: 11, color: "#ccc" }}>no notes</span>
                      )}
                    </div>
                    {periodNotes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          background: "white",
                          borderRadius: 8,
                          padding: "8px 10px",
                          marginBottom: 6,
                          borderLeft: `3px solid ${note.shared ? COLORS.secondary : COLORS.accent}`,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <p style={{ margin: 0, fontSize: 13, color: COLORS.dark, lineHeight: 1.4 }}>{note.text}</p>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, marginLeft: 6, flexShrink: 0 }}
                          >
                            &#10005;
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10, color: "#999" }}>
                          <span>{note.timestamp}</span>
                          <button
                            onClick={() => handleToggleNoteVisibility(note.id, note.shared)}
                            style={{
                              background: note.shared ? COLORS.secondary : "#999",
                              color: "white",
                              border: "none",
                              borderRadius: 4,
                              padding: "1px 6px",
                              fontWeight: 700,
                              fontSize: 10,
                              cursor: "pointer",
                            }}
                          >
                            {note.shared ? "\uD83E\uDD1D Shared" : "\uD83D\uDD12 Private"}
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Inline add for this period */}
                    <div style={{ display: "flex", gap: 6, marginTop: periodNotes.length > 0 ? 4 : 0 }}>
                      <input
                        placeholder={`Add note for ${slot.label}...`}
                        id={`modal-note-${slot.label}`}
                        style={{
                          flex: 1,
                          borderRadius: 6,
                          border: "1px solid #d0d0d0",
                          padding: "6px 8px",
                          fontSize: 12,
                          fontFamily: "inherit",
                          color: "#2d3a47",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                            handleAddNote((e.target as HTMLInputElement).value, noteShared, slot.label);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`modal-note-${slot.label}`) as HTMLInputElement;
                          if (input?.value.trim()) {
                            handleAddNote(input.value, noteShared, slot.label);
                            input.value = "";
                          }
                        }}
                        style={{
                          background: COLORS.secondary,
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Legacy notes (no period) */}
              {notes.filter((n) => n.period === null).length > 0 && (
                <div style={{ background: "#fafaf7", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>General</div>
                  {notes.filter((n) => n.period === null).map((note) => (
                    <div
                      key={note.id}
                      style={{
                        background: "white",
                        borderRadius: 8,
                        padding: "8px 10px",
                        marginBottom: 6,
                        borderLeft: `3px solid ${note.shared ? COLORS.secondary : COLORS.accent}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <p style={{ margin: 0, fontSize: 13, color: COLORS.dark, lineHeight: 1.4 }}>{note.text}</p>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 14, marginLeft: 6, flexShrink: 0 }}
                        >
                          &#10005;
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10, color: "#999" }}>
                        <span>{note.timestamp}</span>
                        <button
                          onClick={() => handleToggleNoteVisibility(note.id, note.shared)}
                          style={{
                            background: note.shared ? COLORS.secondary : "#999",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            padding: "1px 6px",
                            fontWeight: 700,
                            fontSize: 10,
                            cursor: "pointer",
                          }}
                        >
                          {note.shared ? "\uD83E\uDD1D Shared" : "\uD83D\uDD12 Private"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Global shared/private toggle for new notes */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "8px 0", borderTop: "1px solid #eee" }}>
              <div
                onClick={() => setNoteShared(!noteShared)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  background: noteShared ? COLORS.secondary : "#ccc",
                  position: "relative",
                  transition: "background 0.2s",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "white",
                  position: "absolute",
                  top: 2,
                  left: noteShared ? 18 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: 12, color: COLORS.dark }}>
                {noteShared ? "New notes: Shared (visible to parents)" : "New notes: Private (teacher only)"}
              </span>
            </div>
            </>)}

            {/* History Tab */}
            {notesTab === "history" && (
              <div>
                <input
                  value={noteHistorySearch}
                  onChange={(e) => setNoteHistorySearch(e.target.value)}
                  placeholder="Search notes..."
                  style={{ width: "100%", borderRadius: 8, border: "1px solid #d0d0d0", padding: "8px 12px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }}
                />
                {noteHistoryLoading ? (
                  <div style={{ textAlign: "center", padding: 20, color: "#999" }}>Loading history...</div>
                ) : (() => {
                  const filtered = noteHistorySearch.trim()
                    ? noteHistory.filter((n) => n.text.toLowerCase().includes(noteHistorySearch.toLowerCase()) || (n.period ?? "").toLowerCase().includes(noteHistorySearch.toLowerCase()))
                    : noteHistory;
                  // Group by date
                  const byDate = new Map<string, StudentNote[]>();
                  for (const n of filtered) {
                    const d = n.date ?? "Unknown";
                    if (!byDate.has(d)) byDate.set(d, []);
                    byDate.get(d)!.push(n);
                  }
                  if (byDate.size === 0) {
                    return <div style={{ textAlign: "center", padding: 20, color: "#999", fontSize: 13 }}>No notes found.</div>;
                  }
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {Array.from(byDate.entries()).map(([date, dateNotes]) => (
                        <div key={date}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.dark, marginBottom: 6, padding: "4px 0", borderBottom: "1px solid #eee" }}>
                            {new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          {dateNotes.map((note) => (
                            <div
                              key={note.id}
                              style={{
                                padding: "6px 10px",
                                marginBottom: 4,
                                borderLeft: `3px solid ${note.shared ? COLORS.secondary : COLORS.accent}`,
                                background: "#fafaf7",
                                borderRadius: 6,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ fontSize: 12, color: COLORS.dark, lineHeight: 1.4 }}>
                                  <span style={{ fontWeight: 700, color: COLORS.secondary }}>{note.period ?? "General"}</span>
                                  {" \u2014 "}
                                  {note.text}
                                </div>
                                <button
                                  onClick={async () => { await handleDeleteNote(note.id); setNoteHistory((prev) => prev.filter((n) => n.id !== note.id)); }}
                                  style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 12, flexShrink: 0, marginLeft: 4 }}
                                >
                                  &#10005;
                                </button>
                              </div>
                              <div style={{ fontSize: 10, color: "#999", marginTop: 2, display: "flex", gap: 6, alignItems: "center" }}>
                                <span>{note.timestamp}</span>
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "white",
                                  background: note.shared ? COLORS.secondary : "#999",
                                  borderRadius: 3,
                                  padding: "0 5px",
                                }}>
                                  {note.shared ? "Shared" : "Private"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

            {/* Your school — read-only. Determined by the teacher's assignment
                (set by their site admin), not chosen here. */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                Your School
              </div>
              {selectedSchool ? (
                <div
                  style={{
                    background: "#f5f5f0",
                    border: "1px solid #d0d0d0",
                    borderRadius: 10,
                    padding: "14px 18px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: COLORS.dark,
                  }}
                >
                  &#127979; {selectedSchool}
                  <span style={{ display: "block", fontSize: 11, fontWeight: 500, marginTop: 2, color: "#888" }}>
                    Set by your school admin
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    background: "#fff8f0",
                    border: "1px solid #f0c890",
                    borderRadius: 10,
                    padding: "14px 18px",
                    fontSize: 13,
                    color: "#8a6d3b",
                  }}
                >
                  You haven&apos;t been assigned to a school yet. Ask your site admin
                  or founder to add you.
                </div>
              )}
            </div>

            {/* Schedule Type Selection */}
            {selectedSchool && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                  Schedule Type
                </div>
                {Object.keys(schedulesForSchool).length === 0 ? (
                  <div
                    style={{
                      background: "#fff8f0",
                      border: "1px solid #f0c890",
                      borderRadius: 10,
                      padding: "12px 16px",
                      fontSize: 13,
                      color: "#8a6d3b",
                    }}
                  >
                    No bell schedule has been set for {selectedSchool} yet. Your
                    site admin uploads it, then it&apos;ll show up here.
                  </div>
                ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.keys(schedulesForSchool).map((type) => (
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
                )}
              </div>
            )}

            {/* Lunch Preference */}
            {selectedSchool && selectedSchool !== "Cosumnes Oaks High School" && (() => {
              const sched = schedulesForSchool?.[selectedSchedule] ?? schedulesForSchool?.[Object.keys(schedulesForSchool)[0]];
              const periods = sched?.periods ?? [];
              const splitLunch = periods.some(p => p.label === "Period 4") && periods.some(p => p.label === "Period 5");
              if (!splitLunch) return null;
              return (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark, marginBottom: 8 }}>
                    Lunch Preference
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["1st", "2nd"] as const).map((pref) => (
                      <button
                        key={pref}
                        onClick={() => handleLunchPref(pref)}
                        style={{
                          background: lunchPref === pref ? COLORS.secondary : "#f0f0f0",
                          color: lunchPref === pref ? "white" : COLORS.dark,
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 16px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {pref === "1st" ? "🍽 1st Lunch" : "🍽 2nd Lunch"}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                    {lunchPref === "1st" ? "You have lunch during Period 4 — Period 5 will be tracked." : "You have lunch during Period 5 — Period 4 will be tracked."}
                  </div>
                </div>
              );
            })()}

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
                    {(() => {
                      const sched = schedulesForSchool[selectedSchedule] ?? schedulesForSchool[Object.keys(schedulesForSchool)[0]];
                      const periods = sched?.periods ?? [];
                      const splitLunch = periods.some(p => p.label === "Period 4") && periods.some(p => p.label === "Period 5");
                      return periods.map((slot, i) => {
                      const isLunchPeriod = splitLunch && (
                        (lunchPref === "1st" && slot.label === "Period 4") ||
                        (lunchPref === "2nd" && slot.label === "Period 5")
                      );
                      const isTracked = slot.label !== "Lunch" && slot.label !== "Rally" && !isLunchPeriod;
                      return (
                        <tr key={slot.label + i} style={{ background: i % 2 === 0 ? "#fafaf7" : "white", borderTop: "1px solid #eee", opacity: isLunchPeriod ? 0.4 : 1 }}>
                          <td style={{ padding: "8px 12px", fontWeight: 600, color: COLORS.dark }}>{slot.label}{isLunchPeriod ? " (your lunch)" : ""}</td>
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
                    });
                    })()}
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

            {/* Show Period 0 Toggle */}
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark }}>
                  Show Period 0
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>Include the before-school zero-period row in the scoring grid</div>
              </div>
              <div
                onClick={() => savePreferences({ ...prefs, showPeriodZero: !prefs.showPeriodZero })}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: prefs.showPeriodZero ? C.secondary : "#ccc",
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
                  left: prefs.showPeriodZero ? 22 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>

            {/* Demo Mode */}
            <div style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 10,
              background: "#fafafa",
              border: "1px solid #e8e8e8",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: C.dark, marginBottom: 6 }}>
                Demo Mode
              </div>
              <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginBottom: 10 }}>
                Load 8 weeks of fake student data to demo the app. All demo data is tagged with <strong>[DEMO]</strong> and can be wiped with one click. Does not affect your real students.
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: demoStudentCount > 0 ? C.secondary : "#888",
                marginBottom: 12,
              }}>
                Demo data: {demoStudentCount > 0 ? `${demoStudentCount} students, 8 weeks loaded` : "not loaded"}
              </div>

              {demoMessage && (
                <div style={{
                  fontSize: 12,
                  padding: "8px 10px",
                  borderRadius: 6,
                  marginBottom: 10,
                  background: demoMessage.success ? "#e8f5ee" : "#fdecea",
                  color: demoMessage.success ? "#1d6a4a" : "#a02622",
                  border: `1px solid ${demoMessage.success ? "#bfe2cf" : "#f5c6c2"}`,
                }}>
                  {demoMessage.text}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={handleLoadDemo}
                  disabled={demoBusy !== null}
                  style={{
                    background: C.primary,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: demoBusy ? "wait" : "pointer",
                    opacity: demoBusy ? 0.7 : 1,
                  }}
                >
                  {demoBusy === "seed" ? "Loading…" : "Load Demo Data"}
                </button>
                <button
                  onClick={() => setShowWipeConfirm(true)}
                  disabled={demoBusy !== null || demoStudentCount === 0}
                  style={{
                    background: demoStudentCount === 0 ? "#ccc" : "#c0392b",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: demoBusy || demoStudentCount === 0 ? "not-allowed" : "pointer",
                    opacity: demoBusy ? 0.7 : 1,
                  }}
                >
                  {demoBusy === "wipe" ? "Wiping…" : "Wipe Demo Data"}
                </button>
              </div>
            </div>

            {isSiteAdmin && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #d0d0d0" }}>
                <div style={{ fontSize: 13, color: "#8a9690", marginBottom: 8 }}>
                  Site Admin tools
                </div>
                <a
                  href="/admin/upload-schedule"
                  style={{
                    display: "inline-block",
                    padding: "8px 14px",
                    background: "transparent",
                    color: "#3a7c6a",
                    border: "1px solid #3a7c6a",
                    borderRadius: 6,
                    fontSize: 14,
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  Upload bell schedule
                </a>
              </div>
            )}

            {isFounder && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #d0d0d0" }}>
                <div style={{ fontSize: 13, color: "#8a9690", marginBottom: 8 }}>
                  Founder tools
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <a
                    href="/admin/requests"
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      background: "transparent",
                      color: "#3a7c6a",
                      border: "1px solid #3a7c6a",
                      borderRadius: 6,
                      fontSize: 14,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Beta access requests
                  </a>
                  <a
                    href="/admin/teachers"
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      background: "transparent",
                      color: "#3a7c6a",
                      border: "1px solid #3a7c6a",
                      borderRadius: 6,
                      fontSize: 14,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Teachers (act-as)
                  </a>
                  <a
                    href="/admin/audit-log"
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      background: "transparent",
                      color: "#3a7c6a",
                      border: "1px solid #3a7c6a",
                      borderRadius: 6,
                      fontSize: 14,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Audit log
                  </a>
                  <a
                    href="/admin/break-glass"
                    style={{
                      display: "inline-block",
                      padding: "8px 14px",
                      background: "transparent",
                      color: "#e11d48",
                      border: "1px solid #e11d48",
                      borderRadius: 6,
                      fontSize: 14,
                      textDecoration: "none",
                      fontWeight: 500,
                    }}
                  >
                    Break-glass
                  </a>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #d0d0d0" }}>
              <a
                href="/audit/me"
                style={{
                  fontSize: 13,
                  color: "#8a9690",
                  textDecoration: "underline",
                }}
              >
                View account access log
              </a>
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

      {/* ─── Wipe Demo Confirm Modal ──────────────────────────────────────────── */}
      {showWipeConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowWipeConfirm(false); }}
        >
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 28,
            width: "90%",
            maxWidth: 420,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, color: C.dark }}>
              Wipe demo data?
            </h2>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.5, margin: "0 0 20px" }}>
              Delete all demo students and their data? This cannot be undone. Your real students are not affected.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowWipeConfirm(false)}
                style={{
                  background: "#f0f0f0",
                  color: "#333",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleWipeDemo}
                style={{
                  background: "#c0392b",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Yes, wipe demo data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";
import type { User } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  arrival: ArrivalValue | null;
  compliance: ScaleValue | null;
  social: ScaleValue | null;
  onTask: ScaleValue | null;
  phoneAway: ToggleValue | null;
}

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

interface TeacherProfile {
  teacher_id: string;
  school_id: string;
  school_name: string;
  full_name: string;
  email: string;
}

const DEFAULT_SCORES: PeriodScores = {
  arrival: null,
  compliance: null,
  social: null,
  onTask: null,
  phoneAway: null,
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
  return arrivalPts + (p.compliance ?? 0) + (p.social ?? 0) + (p.onTask ?? 0) + phonePts;
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

function scaleColor(value: ScaleValue | null): string {
  switch (value) {
    case 3: return COLORS.secondary;
    case 2: return COLORS.accent;
    case 1: return COLORS.primary;
    case 0: return "#b0b0b0";
    default: return "#e8e8e8";
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
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [dbStudents, setDbStudents] = useState<DbStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
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
  const [showParentView, setShowParentView] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  // Draggable zone thresholds: [needsSupport→workingOnIt, workingOnIt→onTrack, onTrack→exceptional]
  const [thresholds, setThresholds] = useState<[number, number, number]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dailywins_thresholds");
      if (saved) return JSON.parse(saved) as [number, number, number];
    }
    return [50, 70, 90];
  });
  const draggingRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const prevPctRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: selected student display name
  const selectedStudent = dbStudents.find((s) => s.id === selectedStudentId)?.display_name ?? "";
  const students = dbStudents.map((s) => s.display_name);
  const hasStudents = dbStudents.length > 0;

  // --- Auth + teacher profile setup ---
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) {
        router.replace("/");
        setLoading(false);
        return;
      }
      setUser(u);

      // Ensure teacher record exists (creates school + teacher on first login)
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
      setTeacher(profile);

      // Load students for this school
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
      // Fall back to localStorage cache
      const cached = localStorage.getItem("dailywins_students");
      if (cached) {
        const names = JSON.parse(cached) as string[];
        // Can't use cached names as DB students without IDs, so just show empty
      }
      return;
    }

    const list = (data ?? []) as DbStudent[];
    setDbStudents(list);
    // Cache display names in localStorage as fallback
    localStorage.setItem("dailywins_students", JSON.stringify(list.map((s) => s.display_name)));
    if (list.length > 0 && !selectedStudentId) {
      setSelectedStudentId(list[0].id);
    }
  };

  // Confetti trigger
  const { pct } = calculateProgress(scores);
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

  const handleThresholdDrag = useCallback((clientX: number) => {
    const idx = draggingRef.current;
    if (idx === null || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    let pctVal = Math.round(((clientX - rect.left) / rect.width) * 100);
    // Clamp: min 5 apart from neighbors, within 5-95
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
    const onUp = () => { draggingRef.current = null; };
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

  // Derive active periods from schedule
  const activePeriods: PeriodSlot[] = selectedSchool
    ? BELL_SCHEDULES[selectedSchool][selectedSchedule].periods
    : PERIODS.map((p) => ({ label: p, start: "", end: "" }));

  // Trackable periods (exclude Lunch, Rally)
  const trackablePeriods = activePeriods.filter(
    (p) => p.label !== "Lunch" && p.label !== "Rally"
  );

  // --- Map period labels to period numbers (1-8) for DB ---
  const periodLabelToNumber = (label: string): number => {
    const match = label.match(/Period (\d)/);
    if (match) return parseInt(match[1], 10);
    if (label === "Advocacy") return 8;
    // Finals or other custom labels — map by index
    const idx = trackablePeriods.findIndex((p) => p.label === label);
    return idx >= 0 ? idx + 1 : 1;
  };

  const periodNumberToLabel = (num: number): string => {
    if (num === 8) return "Advocacy";
    return `Period ${num}`;
  };

  // --- Convert between DB row and UI score ---
  const arrivalFromDb = (val: number | null): ArrivalValue | null => {
    if (val === null) return null;
    if (val === 3) return "On Time";
    if (val === 1) return "L/E";
    return "L";
  };

  const arrivalToDb = (val: ArrivalValue | null): number | null => {
    if (val === null) return null;
    if (val === "On Time") return 3;
    if (val === "L/E") return 1;
    return 0;
  };

  const phoneFromDb = (val: boolean | null): ToggleValue | null => {
    if (val === null) return null;
    return val ? "Yes" : "No";
  };

  const phoneToDb = (val: ToggleValue | null): boolean | null => {
    if (val === null) return null;
    return val === "Yes";
  };

  // --- Load scores from Supabase when student/date changes ---
  const loadScores = useCallback(async (studentId: string, date: string) => {
    if (!teacher) return;
    const { data, error } = await supabase
      .from("behavior_scores")
      .select("*")
      .eq("student_id", studentId)
      .eq("teacher_id", teacher.teacher_id)
      .eq("score_date", date);

    const newScores: Record<string, PeriodScores> = {};
    for (const p of trackablePeriods) {
      newScores[p.label] = { ...DEFAULT_SCORES };
    }

    if (!error && data) {
      for (const row of data) {
        const label = periodNumberToLabel(row.period);
        if (label in newScores) {
          newScores[label] = {
            arrival: arrivalFromDb(row.arrival),
            compliance: row.compliance as ScaleValue | null,
            social: row.social as ScaleValue | null,
            onTask: row.on_task as ScaleValue | null,
            phoneAway: phoneFromDb(row.phone_away),
          };
        }
      }
    }

    setScores(newScores);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, trackablePeriods.length]);

  // --- Load notes from Supabase ---
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

  // Trigger score + note load when student/date/schedule changes
  useEffect(() => {
    if (selectedStudentId && teacher) {
      loadScores(selectedStudentId, selectedDate);
      loadNotes(selectedStudentId);
    } else {
      // Reset to defaults
      const initial: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        initial[p.label] = { ...DEFAULT_SCORES };
      }
      setScores(initial);
      setNotes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, selectedDate, selectedSchool, selectedSchedule, teacher]);

  // --- Save a single period's scores to Supabase (debounced) ---
  const saveScoresToDb = useCallback(async (periodScores: Record<string, PeriodScores>) => {
    if (!teacher || !selectedStudentId) return;

    const upserts = trackablePeriods
      .map((slot) => {
        const ps = periodScores[slot.label];
        if (!ps) return null;
        return {
          student_id: selectedStudentId,
          teacher_id: teacher.teacher_id,
          score_date: selectedDate,
          period: periodLabelToNumber(slot.label),
          arrival: arrivalToDb(ps.arrival),
          compliance: ps.compliance,
          social: ps.social,
          on_task: ps.onTask,
          phone_away: phoneToDb(ps.phoneAway),
        };
      })
      .filter(Boolean);

    if (upserts.length === 0) return;

    const { error } = await supabase
      .from("behavior_scores")
      .upsert(upserts, { onConflict: "student_id,teacher_id,score_date,period" });

    if (error) {
      console.error("Failed to save scores:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, selectedStudentId, selectedDate, trackablePeriods.length]);

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
    setScores((prev) => {
      const updated = {
        ...prev,
        [period]: { ...prev[period], [category]: value },
      };
      // Debounced save to Supabase
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(updated), 500);
      return updated;
    });
  };

  const quickFillAll = () => {
    setScores(() => {
      const filled: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        filled[p.label] = { ...QUICK_FILL_DEFAULTS };
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(filled), 500);
      return filled;
    });
  };

  const quickClearAll = () => {
    setScores(() => {
      const cleared: Record<string, PeriodScores> = {};
      for (const p of trackablePeriods) {
        cleared[p.label] = { ...DEFAULT_SCORES };
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(cleared), 500);
      return cleared;
    });
  };

  const quickFillColumn = (category: keyof PeriodScores) => {
    setScores((prev) => {
      const updated = { ...prev };
      for (const p of trackablePeriods) {
        updated[p.label] = { ...updated[p.label], [category]: QUICK_FILL_DEFAULTS[category] };
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveScoresToDb(updated), 500);
      return updated;
    });
  };

  const handleAddStudents = async () => {
    const names = addStudentsText
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0 || !teacher) return;

    // Insert into students table
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

  const formatScoreDisplay = (val: ScaleValue | null): string => val === null ? "—" : String(val);
  const formatArrivalDisplay = (val: ArrivalValue | null): string => val ?? "—";
  const formatPhoneDisplay = (val: ToggleValue | null): string => val ?? "—";

  const generateDailyPDF = () => {
    const doc = new jsPDF();
    const { earned: e, possible: p, pct: pc } = calculateProgress(scores);

    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("DailyWins — Daily Report", 14, 20);

    doc.setFontSize(12);
    doc.text(`Student: ${selectedStudent || "N/A"}`, 14, 32);
    doc.text(`Date: ${selectedDate}`, 14, 40);
    doc.text(`Daily Score: ${e} / ${p} pts (${pc}%)`, 14, 48);

    const rows = trackablePeriods.map((slot) => {
      const ps = scores[slot.label] ?? { ...DEFAULT_SCORES };
      return [
        slot.label,
        slot.start ? `${slot.start}–${slot.end}` : "",
        formatArrivalDisplay(ps.arrival),
        formatScoreDisplay(ps.compliance),
        formatScoreDisplay(ps.social),
        formatScoreDisplay(ps.onTask),
        formatPhoneDisplay(ps.phoneAway),
        String(periodPoints(ps)),
      ];
    });

    autoTable(doc, {
      startY: 56,
      head: [["Period", "Time", "Arrival", "Comply", "Social", "On-Task", "Phone", "Pts"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [44, 62, 80], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold" } },
    });

    doc.save(`DailyWins_${selectedStudent || "report"}_${selectedDate}.pdf`);
  };

  const generateWeeklyPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text("DailyWins — Weekly Report", 14, 20);

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
      const ps = scores[slot.label] ?? { ...DEFAULT_SCORES };
      const todayPts = periodPoints(ps);
      const row: string[] = [slot.label];
      for (let d = 0; d < 5; d++) {
        if (days[d] === selectedDate) {
          row.push(String(todayPts));
        } else {
          row.push("—");
        }
      }
      return row;
    });

    const { earned: e, possible: p, pct: pc } = calculateProgress(scores);
    const totalRow = ["TOTAL"];
    for (let d = 0; d < 5; d++) {
      if (days[d] === selectedDate) {
        totalRow.push(`${e}/${p} (${pc}%)`);
      } else {
        totalRow.push("—");
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
    doc.text("Note: Only today's data is shown. Other days will populate as data is saved.", 14, (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY + 12 || 200);

    doc.save(`DailyWins_Weekly_${selectedStudent || "report"}_${days[0]}.pdf`);
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

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f0", fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      <ConfettiCanvas active={showConfetti} />

      {/* Header */}
      <header style={{ background: COLORS.dark, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
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
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
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
          {/* Student Selector - only shown when students exist */}
          {hasStudents && (
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: COLORS.dark }}>
                Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
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
                {dbStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.display_name}</option>
                ))}
              </select>
            </div>
          )}

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

          {/* Progress Bar with Draggable Thresholds */}
          <div style={{ marginLeft: "auto", flex: 1, minWidth: 220, maxWidth: 420 }}>
            {/* Score line above bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 800, color: COLORS.dark }}>
                <span>⭐</span>
                <span>{earned} / {possible} pts ({pct}%)</span>
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
              style={{ position: "relative", height: 22, borderRadius: 11, background: "#e0e0e0", userSelect: "none" }}
            >
              {/* Zone segments */}
              <div style={{ position: "absolute", top: 0, left: 0, width: `${thresholds[0]}%`, height: "100%", background: COLORS.red, opacity: 0.25, borderRadius: "11px 0 0 11px" }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[0]}%`, width: `${thresholds[1] - thresholds[0]}%`, height: "100%", background: COLORS.gold, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[1]}%`, width: `${thresholds[2] - thresholds[1]}%`, height: "100%", background: COLORS.green, opacity: 0.25 }} />
              <div style={{ position: "absolute", top: 0, left: `${thresholds[2]}%`, width: `${100 - thresholds[2]}%`, height: "100%", background: COLORS.blue, opacity: 0.25, borderRadius: "0 11px 11px 0" }} />
              {/* Fill */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${pct}%`,
                borderRadius: 11,
                background: zoneColor(pct),
                transition: draggingRef.current !== null ? "none" : "width 0.4s ease, background 0.4s ease",
              }} />
              {/* Draggable handles */}
              {thresholds.map((t, idx) => (
                <div
                  key={idx}
                  onMouseDown={(e) => { e.preventDefault(); draggingRef.current = idx; handleThresholdDrag(e.clientX); }}
                  onTouchStart={(e) => { draggingRef.current = idx; handleThresholdDrag(e.touches[0].clientX); }}
                  style={{
                    position: "absolute",
                    left: `${t}%`,
                    top: -3,
                    width: 14,
                    height: 28,
                    marginLeft: -7,
                    cursor: "ew-resize",
                    zIndex: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{
                    width: 6,
                    height: 20,
                    borderRadius: 3,
                    background: "white",
                    border: "2px solid #999",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                  }} />
                </div>
              ))}
            </div>
            {/* Zone labels */}
            <div style={{ position: "relative", height: 16, marginTop: 3, fontSize: 9, fontWeight: 700, color: "#999" }}>
              <span style={{ position: "absolute", left: 0, width: `${thresholds[0]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Needs Support</span>
              <span style={{ position: "absolute", left: `${thresholds[0]}%`, width: `${thresholds[1] - thresholds[0]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Working On It</span>
              <span style={{ position: "absolute", left: `${thresholds[1]}%`, width: `${thresholds[2] - thresholds[1]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>On Track</span>
              <span style={{ position: "absolute", left: `${thresholds[2]}%`, width: `${100 - thresholds[2]}%`, textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>Exceptional</span>
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
                              onClick={() => updateScore(slot.label, "arrival", ps.arrival === val ? null : val)}
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
                              onClick={() => updateScore(slot.label, "compliance", ps.compliance === val ? null : val)}
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
                              onClick={() => updateScore(slot.label, "social", ps.social === val ? null : val)}
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
                              onClick={() => updateScore(slot.label, "onTask", ps.onTask === val ? null : val)}
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
                              onClick={() => updateScore(slot.label, "phoneAway", ps.phoneAway === val ? null : val)}
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
          <button
            onClick={generateDailyPDF}
            style={{
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
            }}
          >
            📄 Daily PDF
          </button>
          <button
            onClick={generateWeeklyPDF}
            style={{
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
            }}
          >
            📊 Weekly PDF
          </button>
          <button
            onClick={() => setShowParentView(true)}
            style={{
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
            }}
          >
            🏠 Parent View
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

      {/* Parent View Modal */}
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
                🏠 Parent View
              </h2>
              <button
                onClick={() => setShowParentView(false)}
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#999" }}
              >
                ✕
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
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Arrival</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Comply</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Social</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>On-Task</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Phone</th>
                  <th style={{ padding: "8px 6px", textAlign: "center", color: "white", fontSize: 11, fontWeight: 700 }}>Pts</th>
                </tr>
              </thead>
              <tbody>
                {trackablePeriods.map((slot, i) => {
                  const ps = scores[slot.label] ?? { ...DEFAULT_SCORES };
                  const pts = periodPoints(ps);
                  return (
                    <tr key={slot.label + i} style={{ background: i % 2 === 0 ? "#fafaf7" : "white", borderTop: "1px solid #eee" }}>
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: COLORS.dark }}>{slot.label}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>{formatArrivalDisplay(ps.arrival)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>{formatScoreDisplay(ps.compliance)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>{formatScoreDisplay(ps.social)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>{formatScoreDisplay(ps.onTask)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", color: "#555" }}>{formatPhoneDisplay(ps.phoneAway)}</td>
                      <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: pts >= 12 ? COLORS.secondary : pts >= 8 ? COLORS.accent : COLORS.primary }}>{pts}</td>
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

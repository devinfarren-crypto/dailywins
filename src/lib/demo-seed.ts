import type { SupabaseClient } from "@supabase/supabase-js";

export const DEMO_PREFIX = "[DEMO] ";

const DEMO_STUDENTS = [
  { name: "[DEMO] Ava M.", profile: "growth" },
  { name: "[DEMO] Jordan T.", profile: "steady" },
  { name: "[DEMO] Marcus K.", profile: "concern" },
  { name: "[DEMO] Priya S.", profile: "steady" },
  { name: "[DEMO] Diego R.", profile: "steady" },
  { name: "[DEMO] Hannah W.", profile: "steady" },
  { name: "[DEMO] Tyler B.", profile: "steady" },
] as const;

const PERIODS = [1, 2, 3, 4, 5, 6] as const;
const NUM_WEEKDAYS = 40;
const SKIP_RATE = 0.05;

const NOTE_BANK = [
  "Great recovery after rough morning — stayed on task all afternoon.",
  "Following up with parent re: phone use during 4th period.",
  "Excellent peer support today — helped new student during transitions.",
  "Off task most of the day — check in tomorrow morning.",
  "Strong start to the week. Building momentum.",
  "Parent conference scheduled for Thursday.",
  "Handled frustration well during math — used break independently.",
  "Late arrival — coordinate with attendance office.",
  "Phone away streak: 5 days running.",
  "Big win at recess — included someone new in the game.",
  "Needed redirection in 3rd period. Brief reset, back on track.",
  "Asked thoughtful question in advisory. Real growth.",
];

// 32-bit FNV-1a hash → seeds a deterministic PRNG so re-runs produce the same data.
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngFor(...parts: (string | number)[]): () => number {
  return mulberry32(fnv1a(parts.join("|")));
}

// Most-recent-first list of YYYY-MM-DD strings, weekdays only.
function lastNWeekdays(n: number, from = new Date()): string[] {
  const dates: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (dates.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    d.setDate(d.getDate() - 1);
  }
  return dates;
}

// Per-week target rate (0-1) for each profile. weekIdx: 0 = oldest, 7 = most recent.
function rateFor(profile: string, weekIdx: number, dayRng: () => number): number {
  let base: number;
  if (profile === "growth") {
    // Ava: 0.50 → 0.90 over 8 weeks
    base = 0.5 + (weekIdx / 7) * 0.4;
  } else if (profile === "concern") {
    // Marcus: 0.85 → dip to ~0.55 mid-year → recover to ~0.68
    const curve = [0.85, 0.85, 0.75, 0.65, 0.55, 0.55, 0.62, 0.68];
    base = curve[weekIdx] ?? 0.7;
  } else {
    // steady: ~0.78 with mild week-to-week drift
    base = 0.78 + Math.sin(weekIdx * 0.9) * 0.04;
  }
  // ±0.06 day-to-day jitter so consecutive days don't look identical.
  const jitter = (dayRng() - 0.5) * 0.12;
  return Math.max(0.2, Math.min(0.97, base + jitter));
}

function pickScale(rate: number, rng: () => number): number {
  // Score 0-3 centered around rate*3 with realistic noise.
  const target = rate * 3;
  const noise = (rng() - 0.5) * 1.6;
  let s = Math.round(target + noise);
  // Rare outliers so even good students have off moments.
  const tail = rng();
  if (tail < 0.04) s -= 1;
  else if (tail > 0.96) s += 1;
  if (s < 0) s = 0;
  if (s > 3) s = 3;
  return s;
}

function pickArrival(rate: number, rng: () => number): number {
  // Binary: 0 (Late) or 2 (On Time). Bias toward 2.
  const onTimeProb = 0.75 + rate * 0.22; // ~0.92 for high performers, ~0.85 baseline
  return rng() < onTimeProb ? 2 : 0;
}

function pickPhoneAway(rate: number, rng: () => number): number {
  // Binary: 0 or 1. Target ~85% phone-away overall, scaled by rate.
  const awayProb = 0.7 + rate * 0.22;
  return rng() < awayProb ? 1 : 0;
}

interface ScoreRow {
  student_id: string;
  teacher_id: string;
  score_date: string;
  period: number;
  scores: Record<string, number>;
}

interface NoteRow {
  student_id: string;
  teacher_id: string;
  note_date: string;
  content: string;
  is_private: boolean;
  period: string | null;
}

export async function wipeDemoData(
  admin: SupabaseClient,
  teacherId: string
): Promise<{ studentsDeleted: number }> {
  // Find this teacher's school, then delete demo students at that school.
  // CASCADE handles behavior_scores and notes.
  const { data: teacher, error: teacherErr } = await admin
    .from("teachers")
    .select("school_id")
    .eq("id", teacherId)
    .single();

  if (teacherErr || !teacher) {
    throw new Error(`Teacher not found: ${teacherErr?.message ?? "no row"}`);
  }

  const { data: deleted, error: delErr } = await admin
    .from("students")
    .delete()
    .eq("school_id", teacher.school_id)
    .like("display_name", `${DEMO_PREFIX}%`)
    .select("id");

  if (delErr) {
    throw new Error(`Failed to delete demo students: ${delErr.message}`);
  }

  return { studentsDeleted: deleted?.length ?? 0 };
}

export async function seedDemoData(
  admin: SupabaseClient,
  teacherId: string,
  schoolId: string
): Promise<{
  studentsCreated: number;
  scoresCreated: number;
  notesCreated: number;
}> {
  // Idempotent: wipe any existing demo data for this teacher first.
  await wipeDemoData(admin, teacherId);

  // 1. Insert demo students.
  const studentRows = DEMO_STUDENTS.map((s) => ({
    school_id: schoolId,
    display_name: s.name,
  }));

  const { data: insertedStudents, error: studentsErr } = await admin
    .from("students")
    .insert(studentRows)
    .select("id, display_name");

  if (studentsErr || !insertedStudents) {
    throw new Error(
      `Failed to insert demo students: ${studentsErr?.message ?? "no data"}`
    );
  }

  const studentByName = new Map(
    insertedStudents.map((s: { id: string; display_name: string }) => [
      s.display_name,
      s.id,
    ])
  );

  // 2. Build behavior_scores rows.
  const dates = lastNWeekdays(NUM_WEEKDAYS); // index 0 = today, 39 = oldest
  const scoreRows: ScoreRow[] = [];

  for (const demo of DEMO_STUDENTS) {
    const studentId = studentByName.get(demo.name);
    if (!studentId) continue;

    for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
      const date = dates[dayIdx];
      const weekFromStart = 7 - Math.floor(dayIdx / 5); // 0 = oldest, 7 = most recent
      const dayRng = rngFor(demo.name, date);
      const dailyRate = rateFor(demo.profile, weekFromStart, dayRng);

      for (const period of PERIODS) {
        const cellRng = rngFor(demo.name, date, period);
        if (cellRng() < SKIP_RATE) continue; // student absent / period unscored

        scoreRows.push({
          student_id: studentId,
          teacher_id: teacherId,
          score_date: date,
          period,
          scores: {
            arrival: pickArrival(dailyRate, cellRng),
            compliance: pickScale(dailyRate, cellRng),
            social: pickScale(dailyRate, cellRng),
            onTask: pickScale(dailyRate, cellRng),
            phoneAway: pickPhoneAway(dailyRate, cellRng),
          },
        });
      }
    }
  }

  // Chunk size > expected row count (~1.5k) so the common path is one round-trip;
  // chunking still kicks in if seed parameters grow.
  const CHUNK = 2000;
  let scoresCreated = 0;
  for (let i = 0; i < scoreRows.length; i += CHUNK) {
    const chunk = scoreRows.slice(i, i + CHUNK);
    const { error: scoresErr, count } = await admin
      .from("behavior_scores")
      .upsert(chunk, {
        onConflict: "student_id,teacher_id,score_date,period",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (scoresErr) {
      throw new Error(`Failed to insert scores: ${scoresErr.message}`);
    }
    scoresCreated += count ?? chunk.length;
  }

  // 3. Build notes — 12 spread across students, dates, and periods.
  const noteRng = rngFor("notes", teacherId);
  const noteRows: NoteRow[] = NOTE_BANK.map((content, i) => {
    const student = DEMO_STUDENTS[Math.floor(noteRng() * DEMO_STUDENTS.length)];
    const studentId = studentByName.get(student.name)!;
    const date = dates[Math.floor(noteRng() * dates.length)];
    // Half general (period null), half tied to a specific period.
    const period = i % 2 === 0
      ? null
      : `Period ${PERIODS[Math.floor(noteRng() * PERIODS.length)]}`;
    return {
      student_id: studentId,
      teacher_id: teacherId,
      note_date: date,
      content,
      is_private: true,
      period,
    };
  });

  const { error: notesErr, count: notesCount } = await admin
    .from("notes")
    .insert(noteRows, { count: "exact" });

  if (notesErr) {
    throw new Error(`Failed to insert notes: ${notesErr.message}`);
  }

  return {
    studentsCreated: insertedStudents.length,
    scoresCreated,
    notesCreated: notesCount ?? noteRows.length,
  };
}

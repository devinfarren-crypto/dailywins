// Google Sheets auto-sync for student behavior data
// Uses the Sheets API + Drive API via the teacher's Google OAuth token

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

interface Category {
  id: string;
  name: string;
  type: string;
  options: string[];
  pointValues: number[];
  maxPoints: number;
  noPoints?: boolean;
}

type PeriodScores = Record<string, number | null>;
type AllScores = Record<string, PeriodScores>;

interface PeriodSlot {
  label: string;
  start: string;
  end: string;
}

interface SyncResult {
  success: boolean;
  sheetId?: string;
  error?: string;
  tokenExpired?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOptionLabel(cat: Category, points: number | null): string {
  if (points === null) return "";
  const pv = cat.pointValues ?? [];
  const idx = pv.indexOf(points);
  if (idx >= 0 && idx < cat.options.length) return cat.options[idx];
  return String(points);
}

function periodPoints(ps: PeriodScores, categories: Category[]): number {
  let pts = 0;
  for (const cat of categories) {
    if (cat.noPoints) continue;
    pts += ps[cat.id] ?? 0;
  }
  return pts;
}

function maxPoints(categories: Category[]): number {
  return categories.reduce((s, c) => c.noPoints ? s : s + c.maxPoints, 0);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── Drive folder ────────────────────────────────────────────────────────────

async function ensureDriveFolder(token: string): Promise<string | null> {
  // Search for existing "DailyWins" folder
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(
    "name='DailyWins' and mimeType='application/vnd.google-apps.folder' and trashed=false"
  )}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create "DailyWins" folder
  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "DailyWins",
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) return null;
  const folder = await createRes.json();
  return folder.id;
}

// ─── Create Sheet ────────────────────────────────────────────────────────────

async function createStudentSheet(
  token: string,
  studentName: string,
  folderId: string | null,
): Promise<string | null> {
  // Create the spreadsheet
  const createRes = await fetch(SHEETS_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: `DailyWins - ${studentName}` },
      sheets: [
        { properties: { title: "Today", index: 0 } },
        { properties: { title: "Weekly Summary", index: 1 } },
      ],
    }),
  });

  if (!createRes.ok) return null;
  const sheet = await createRes.json();
  const sheetId = sheet.spreadsheetId as string;

  // Move to DailyWins folder if we have one
  if (folderId) {
    await fetch(
      `${DRIVE_API}/files/${sheetId}?addParents=${folderId}&fields=id`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  }

  return sheetId;
}

// ─── Build sheet data ────────────────────────────────────────────────────────

function buildTodaySheet(
  studentName: string,
  date: string,
  scores: AllScores,
  categories: Category[],
  trackablePeriods: PeriodSlot[],
  sharedNotes: string[],
): string[][] {
  const max = maxPoints(categories);
  const catHeaders = categories.map((c) => c.name + (c.noPoints ? " *" : ""));
  const rows: string[][] = [];

  // Header
  rows.push(["DailyWins - Daily Scores"]);
  rows.push([`Student: ${studentName}`, "", `Date: ${date}`]);
  rows.push([]);

  // Table header
  rows.push(["Period", "Time", ...catHeaders, "Pts"]);

  // Data rows
  let totalEarned = 0;
  for (const slot of trackablePeriods) {
    const ps = scores[slot.label] ?? {};
    const pts = periodPoints(ps, categories);
    totalEarned += pts;
    const row = [
      slot.label,
      slot.start ? `${slot.start} – ${slot.end}` : "",
    ];
    for (const cat of categories) {
      row.push(getOptionLabel(cat, ps[cat.id] ?? null));
    }
    row.push(String(pts));
    rows.push(row);
  }

  // Totals
  const totalPossible = trackablePeriods.length * max;
  const pct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  rows.push([]);
  rows.push(["TOTAL", "", ...categories.map(() => ""), `${totalEarned} / ${totalPossible}`]);
  rows.push(["PERCENTAGE", "", ...categories.map(() => ""), `${pct}%`]);

  // Zone
  const zone = pct >= 90 ? "Exceptional" : pct >= 70 ? "On Track" : pct >= 50 ? "Working On It" : "Needs Support";
  rows.push(["ZONE", "", ...categories.map(() => ""), zone]);

  // No-points note
  if (categories.some((c) => c.noPoints)) {
    rows.push([]);
    rows.push(["* = tracked but not counted toward points"]);
  }

  // Shared notes (NO private notes)
  if (sharedNotes.length > 0) {
    rows.push([]);
    rows.push(["Shared Notes:"]);
    for (const note of sharedNotes) {
      rows.push([note]);
    }
  }

  return rows;
}

function buildWeeklySheet(
  studentName: string,
  date: string,
  scores: AllScores,
  categories: Category[],
  trackablePeriods: PeriodSlot[],
): string[][] {
  const max = maxPoints(categories);
  const rows: string[][] = [];

  // Week calculation
  const dateObj = new Date(date + "T12:00:00");
  const dayOfWeek = dateObj.getDay();
  const monday = new Date(dateObj);
  monday.setDate(dateObj.getDate() - ((dayOfWeek + 6) % 7));
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return formatDate(d);
  });

  rows.push(["DailyWins - Weekly Summary"]);
  rows.push([`Student: ${studentName}`, "", `Week of: ${days[0]} to ${days[4]}`]);
  rows.push([]);

  // Daily totals
  rows.push(["Period", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  for (const slot of trackablePeriods) {
    const ps = scores[slot.label] ?? {};
    const pts = periodPoints(ps, categories);
    const row = [slot.label];
    for (const d of days) {
      row.push(d === date ? String(pts) : "");
    }
    rows.push(row);
  }

  // Total row
  let totalEarned = 0;
  for (const slot of trackablePeriods) {
    totalEarned += periodPoints(scores[slot.label] ?? {}, categories);
  }
  const totalPossible = trackablePeriods.length * max;
  const pct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  const totalRow = ["TOTAL"];
  for (const d of days) {
    totalRow.push(d === date ? `${totalEarned}/${totalPossible} (${pct}%)` : "");
  }
  rows.push(totalRow);

  // Category averages for today
  rows.push([]);
  rows.push(["Category Averages (today)"]);
  rows.push(["Category", "Avg Score", "Max", "Percentage"]);
  for (const cat of categories) {
    let sum = 0;
    let count = 0;
    for (const slot of trackablePeriods) {
      const val = (scores[slot.label] ?? {})[cat.id];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    }
    const avg = count > 0 ? (sum / count).toFixed(1) : "—";
    const catPct = count > 0 ? Math.round((sum / count / cat.maxPoints) * 100) + "%" : "—";
    rows.push([cat.name + (cat.noPoints ? " *" : ""), String(avg), String(cat.maxPoints), catPct]);
  }

  return rows;
}

// ─── Main sync function ──────────────────────────────────────────────────────

export async function syncToGoogleSheets(params: {
  token: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  date: string;
  scores: AllScores;
  categories: Category[];
  trackablePeriods: PeriodSlot[];
  sharedNotes: string[];
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: string) => {
            maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
          };
        };
      };
      insert: (row: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }> } };
      update: (row: Record<string, unknown>) => { eq: (col: string, val: string) => { eq: (col2: string, val2: string) => Promise<{ error: unknown }> } };
    };
  };
}): Promise<SyncResult> {
  const { token, studentId, studentName, teacherId, date, scores, categories, trackablePeriods, sharedNotes, supabase } = params;

  try {
    // 1. Check if we already have a sheet for this student
    const { data: existing } = await supabase
      .from("student_sheets")
      .select("sheet_id, folder_id")
      .eq("student_id", studentId)
      .eq("teacher_id", teacherId)
      .maybeSingle();

    let sheetId: string | null = (existing?.sheet_id as string) ?? null;
    let folderId: string | null = (existing?.folder_id as string) ?? null;

    // 2. Create sheet if it doesn't exist
    if (!sheetId) {
      // Ensure DailyWins folder exists
      folderId = await ensureDriveFolder(token);

      // Create the spreadsheet
      sheetId = await createStudentSheet(token, studentName, folderId);
      if (!sheetId) {
        return { success: false, error: "Failed to create Google Sheet" };
      }

      // Store in Supabase
      await supabase
        .from("student_sheets")
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          sheet_id: sheetId,
          folder_id: folderId,
        })
        .select()
        .single();
    }

    // 3. Build the data
    const todayData = buildTodaySheet(studentName, date, scores, categories, trackablePeriods, sharedNotes);
    const weeklyData = buildWeeklySheet(studentName, date, scores, categories, trackablePeriods);

    // 4. Update both sheets via batchUpdate
    const updateRes = await fetch(`${SHEETS_API}/${sheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [
          {
            range: "Today!A1",
            values: todayData,
          },
          {
            range: "Weekly Summary!A1",
            values: weeklyData,
          },
        ],
      }),
    });

    if (!updateRes.ok) {
      const status = updateRes.status;
      if (status === 401 || status === 403) {
        return { success: false, error: "Token expired", tokenExpired: true };
      }
      const errText = await updateRes.text();
      console.error("Sheets update failed:", status, errText);
      return { success: false, error: `Sheets API error (${status})` };
    }

    // 5. Clear old data beyond our rows (in case sheet had more rows from previous sync)
    const maxRows = Math.max(todayData.length, weeklyData.length) + 5;
    await fetch(`${SHEETS_API}/${sheetId}/values:batchClear`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ranges: [
          `Today!A${todayData.length + 1}:Z500`,
          `Weekly Summary!A${weeklyData.length + 1}:Z500`,
        ],
      }),
    });

    return { success: true, sheetId };
  } catch (err) {
    console.error("Sheets sync error:", err);
    return { success: false, error: String(err) };
  }
}

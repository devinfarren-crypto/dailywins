// Printable student record for the director's Records view (/admin/records).
// One comprehensive PDF of everything on the page: daily / weekly / monthly
// %-of-goals-met (B&W-safe bars — length encodes the value AND the number is
// printed), the by-category breakdown, and every note (shared and private,
// teacher-attributed).
//
// jspdf is browser-only (CLAUDE.md gotcha): this module is imported lazily
// inside the click handler, and jspdf itself is imported lazily here.

import {
  summarizeBehavior,
  type CategoryDef,
  type ChartScoreRow,
  type Grain,
} from "@/src/components/BehaviorCharts";

export interface PdfNote {
  note_date: string;
  period: string | null;
  content: string;
  is_private: boolean;
  teacher_name: string | null;
}

const NAVY: [number, number, number] = [26, 26, 46];
const FOREST: [number, number, number] = [15, 110, 86];
const GRAY: [number, number, number] = [122, 122, 142];
const LIGHT: [number, number, number] = [235, 231, 218];

const GRAIN_TITLE: Record<Grain, string> = {
  daily: "Daily — last 14 school days",
  weekly: "Weekly — last 10 weeks",
  monthly: "Monthly — last 12 months",
};

export async function generateStudentRecordPdf(opts: {
  studentName: string;
  schoolName: string;
  scores: ChartScoreRow[];
  categories: CategoryDef[] | null;
  notes: PdfNote[];
}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16; // margin
  const contentW = pageW - M * 2;
  let y = 0;

  const today = new Date();
  const generated = today.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "normal");
    doc.text(`DailyWins · ${opts.schoolName} · generated ${generated} · record access is audited`, M, pageH - 8);
    doc.text(`Page ${page}`, pageW - M, pageH - 8, { align: "right" });
  };

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - 16) {
      footer();
      doc.addPage();
      y = 16;
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(opts.studentName, M, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(225, 245, 238);
  doc.text(`Student record · ${opts.schoolName} · ${generated}`, M, 22);
  y = 40;

  // ── % of goals met, per grain ────────────────────────────────────────────
  const sectionTitle = (text: string) => {
    ensureRoom(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text(text.toUpperCase(), M, y);
    y += 6;
  };

  // A B&W-safe percent bar row: label, outlined track, proportional fill,
  // printed percentage. Reads in color, grayscale, and pure B&W.
  const barRow = (label: string, pct: number, sub?: string) => {
    ensureRoom(8);
    const barX = M + 34;
    const barW = contentW - 34 - 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 70);
    doc.text(label, M, y + 3.4);
    doc.setDrawColor(...LIGHT);
    doc.setFillColor(250, 248, 242);
    doc.roundedRect(barX, y, barW, 4.6, 1.2, 1.2, "FD");
    if (pct > 0) {
      doc.setFillColor(...FOREST);
      doc.roundedRect(barX, y, Math.max(2, (barW * Math.min(pct, 100)) / 100), 4.6, 1.2, 1.2, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text(`${pct}%`, pageW - M, y + 3.4, { align: "right" });
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...GRAY);
      doc.text(sub, barX + barW - 2, y + 3.2, { align: "right" });
    }
    y += 7.4;
  };

  const grains: Grain[] = ["daily", "weekly", "monthly"];
  let breakdownSource: ReturnType<typeof summarizeBehavior> | null = null;
  for (const grain of grains) {
    const s = summarizeBehavior(opts.scores, opts.categories, grain);
    if (grain === "daily") breakdownSource = s;
    sectionTitle(`% of behavior goals met · ${GRAIN_TITLE[grain]}`);
    if (s.series.length === 0) {
      ensureRoom(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text("No scores in this range.", M, y + 3);
      y += 10;
      continue;
    }
    for (const b of s.series) {
      barRow(b.label, b.pct, `${b.count} period${b.count === 1 ? "" : "s"}`);
    }
    y += 4;
  }

  // ── By category (matches the on-screen breakdown for the daily range) ────
  sectionTitle("By category · last 14 school days");
  const breakdown = breakdownSource?.breakdown ?? [];
  if (breakdown.length === 0 || (breakdownSource?.totalCount ?? 0) === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("No scores in this range.", M, y + 3);
    y += 10;
  } else {
    for (const b of breakdown) {
      barRow(b.name, b.pct);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    ensureRoom(6);
    doc.text(
      `Average across ${breakdownSource!.totalCount} logged period${breakdownSource!.totalCount === 1 ? "" : "s"} in the daily range.`,
      M,
      y + 2
    );
    y += 8;
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  y += 2;
  sectionTitle(`Notes · all teachers, shared and private (${opts.notes.length})`);
  if (opts.notes.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("No notes for this student yet.", M, y + 3);
    y += 10;
  } else {
    for (const n of opts.notes) {
      const meta = [
        fmtDate(n.note_date),
        n.period ? `Period ${n.period}` : null,
        n.teacher_name ?? null,
        n.is_private ? "PRIVATE" : "Shared",
      ]
        .filter(Boolean)
        .join("  ·  ");
      const lines = doc.splitTextToSize(n.content, contentW) as string[];
      ensureRoom(7 + lines.length * 4.2 + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(n.is_private ? 156 : 15, n.is_private ? 58 : 110, n.is_private ? 34 : 86);
      doc.text(meta, M, y + 3);
      y += 6.4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(45, 45, 55);
      doc.text(lines, M, y + 2.4);
      y += lines.length * 4.2 + 2.5;
      doc.setDrawColor(...LIGHT);
      doc.line(M, y, pageW - M, y);
      y += 4;
    }
  }

  footer();

  const safeName = opts.studentName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  doc.save(`DailyWins-Record-${safeName || "student"}-${stamp}.pdf`);
}

function fmtDate(d: string): string {
  try {
    return new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

// Printable student record for the director's Records view (/admin/records).
// A document a director can hand to a placing district: real vertical bar
// charts (the same shape and color grading as the on-screen view), one or two
// charts per page, nothing split across a page boundary.
//
//   Page 1 — navy header + Weekly chart + Monthly chart
//   Page 2 — By-category chart, then the notes begin
//   Notes  — every note (shared and private, teacher-attributed); a note is
//            never split across pages.
//
// jspdf is browser-only (CLAUDE.md gotcha): this module is imported lazily
// inside the click handler, and jspdf itself is imported lazily here.

import {
  summarizeBehavior,
  type CategoryDef,
  type ChartScoreRow,
} from "@/src/components/BehaviorCharts";
import type { TimeBucket } from "@/src/components/BehaviorOverTimeChart";

export interface PdfNote {
  note_date: string;
  period: string | null;
  content: string;
  is_private: boolean;
  teacher_name: string | null;
}

type RGB = [number, number, number];
const NAVY: RGB = [26, 26, 46];
const INK: RGB = [44, 52, 64];
const GRAY: RGB = [128, 130, 142];
const BORDER: RGB = [226, 222, 209];
const GRID: RGB = [232, 230, 222];
const GREEN: RGB = [58, 124, 106]; // strong  (matches BehaviorOverTimeChart)
const GOLD: RGB = [240, 182, 71]; // mixed
const CORAL: RGB = [224, 120, 80]; // needs attention
const TEAL_LIGHT: RGB = [93, 202, 165];
const AMBER: RGB = [239, 159, 39];

// Per-category colors — same ordering as BehaviorCharts.CHART_COLORS.
const CAT_COLORS: RGB[] = [
  [58, 124, 106],
  [52, 152, 219],
  [240, 182, 71],
  [224, 120, 80],
  [155, 89, 182],
  [26, 188, 156],
  [231, 76, 60],
  [243, 156, 18],
];

function gradeColor(pct: number): RGB {
  if (pct >= 80) return GREEN;
  if (pct >= 60) return GOLD;
  return CORAL;
}

// jsPDF instance type without importing jspdf at module scope.
type Doc = InstanceType<(typeof import("jspdf"))["default"]>;

export async function generateStudentRecordPdf(opts: {
  studentName: string;
  schoolName: string;
  generatedBy?: string;
  scores: ChartScoreRow[];
  categories: CategoryDef[] | null;
  categoriesByTeacher?: Record<string, CategoryDef[]> | null;
  notes: PdfNote[];
  // Explicit compliance window ("2026-03-01 to 2026-05-31"). When set, charts
  // show EVERY bucket in range instead of the rolling last-N.
  rangeLabel?: string | null;
}): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const doc: Doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const contentW = pageW - M * 2;

  const today = new Date();
  const generated = today.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const footer = () => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    const by = opts.generatedBy ? ` by ${opts.generatedBy}` : "";
    doc.text(
      `DailyWins · ${opts.schoolName} · generated ${generated}${by} · record access and exports are audited`,
      M,
      pageH - 9
    );
    doc.text(`Page ${doc.getNumberOfPages()}`, pageW - M, pageH - 9, { align: "right" });
  };

  // ── Page 1: header ────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 38, "F");
  // Brand mark: ascending bars + amber dot, top right.
  const markX = pageW - M - 16;
  const bars: { dx: number; h: number; c: RGB }[] = [
    { dx: 0, h: 5, c: TEAL_LIGHT },
    { dx: 4.4, h: 8, c: TEAL_LIGHT },
    { dx: 8.8, h: 11, c: [29, 158, 117] },
    { dx: 13.2, h: 14.5, c: [15, 110, 86] },
  ];
  for (const b of bars) {
    doc.setFillColor(...b.c);
    doc.roundedRect(markX + b.dx, 26 - b.h, 3.2, b.h, 0.8, 0.8, "F");
  }
  doc.setFillColor(...AMBER);
  doc.circle(markX + 16.2, 10.5, 1.6, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEAL_LIGHT);
  doc.text("STUDENT RECORD", M, 13, { charSpace: 1 });
  doc.setFont("times", "bold");
  doc.setFontSize(21);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.studentName, M, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(210, 215, 222);
  doc.text(
    `${opts.schoolName}  ·  ${generated}${opts.rangeLabel ? `  ·  reporting window: ${opts.rangeLabel}` : ""}`,
    M,
    31
  );

  // ── Page 1: weekly + monthly charts ──────────────────────────────────────
  // An explicit reporting window shows EVERY bucket in range; otherwise the
  // rolling last-N default keeps the charts readable.
  const sumOpts = {
    categoriesByTeacher: opts.categoriesByTeacher ?? null,
    ...(opts.rangeLabel ? { maxBuckets: 1000 } : {}),
  };
  const weekly = summarizeBehavior(opts.scores, opts.categories, "weekly", sumOpts);
  const monthly = summarizeBehavior(opts.scores, opts.categories, "monthly", sumOpts);
  const windowNoun = opts.rangeLabel ? `in ${opts.rangeLabel}` : null;

  const CHART_H = 112; // full card height — two fit on page 1 with the header
  drawTimeChart(doc, {
    x: M,
    y: 48,
    w: contentW,
    h: CHART_H,
    title: "Weekly — % of behavior goals met",
    caption: `${weekly.series.length || 0} weeks ${windowNoun ?? "(most recent)"} · ${weekly.totalCount} logged periods · week of (Mon)`,
    data: weekly.series,
  });
  drawTimeChart(doc, {
    x: M,
    y: 48 + CHART_H + 10,
    w: contentW,
    h: CHART_H,
    title: "Monthly — % of behavior goals met",
    caption: `${monthly.series.length || 0} months ${windowNoun ?? "(most recent)"} · ${monthly.totalCount} logged periods`,
    data: monthly.series,
  });
  footer();

  // ── Page 2: by-category chart ─────────────────────────────────────────────
  doc.addPage();
  let y = 20;
  const catData: TimeBucket[] = weekly.breakdown.map((b) => ({
    label: b.name,
    pct: b.pct,
    count: 0,
  }));
  drawTimeChart(doc, {
    x: M,
    y,
    w: contentW,
    h: CHART_H + 6,
    title: "By category — average % of goal points earned",
    caption: `Average across ${weekly.totalCount} logged period${weekly.totalCount === 1 ? "" : "s"} ${windowNoun ?? "in the weekly range"} · each entry scored against its own teacher's category settings`,
    data: catData,
    colors: weekly.breakdown.map((_, i) => CAT_COLORS[i % CAT_COLORS.length]),
    wideBars: true,
  });
  y += CHART_H + 6 + 14;

  // ── Notes ─────────────────────────────────────────────────────────────────
  // splitTextToSize measures with the CURRENT font — set the body font first
  // or lines are measured small and overflow the right margin when rendered.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const noteBlocks = opts.notes.map((n) => {
    const meta = [
      fmtDate(n.note_date),
      n.period ? `Period ${n.period}` : null,
      n.teacher_name ?? null,
    ]
      .filter(Boolean)
      .join("   ·   ");
    const lines = doc.splitTextToSize(n.content, contentW - 8) as string[];
    return { n, meta, lines, height: 7 + lines.length * 4.3 + 5 };
  });

  const sectionHeader = (atY: number): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...NAVY);
    doc.text(`NOTES — ALL TEACHERS, SHARED AND PRIVATE (${opts.notes.length})`, M, atY, { charSpace: 0.4 });
    doc.setDrawColor(...BORDER);
    doc.line(M, atY + 2.5, pageW - M, atY + 2.5);
    return atY + 9;
  };

  // Start notes under the category chart if there's meaningful room,
  // otherwise on a fresh page.
  if (y > pageH - 60) {
    footer();
    doc.addPage();
    y = 20;
  }
  y = sectionHeader(y);

  if (noteBlocks.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text("No notes for this student yet.", M, y + 2);
  }

  for (const block of noteBlocks) {
    // Never split a note across pages (unless it's taller than a whole page).
    if (y + block.height > pageH - 18 && block.height < pageH - 40) {
      footer();
      doc.addPage();
      y = 20;
    }
    const badge = block.n.is_private ? "PRIVATE" : "SHARED";
    const badgeColor: RGB = block.n.is_private ? CORAL : GREEN;
    // Meta row: badge chip + meta text.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    const badgeW = doc.getTextWidth(badge) + 5;
    doc.setFillColor(...badgeColor);
    doc.roundedRect(M, y - 0.5, badgeW, 4.6, 1.4, 1.4, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(badge, M + 2.5, y + 2.7);
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.setFont("helvetica", "bold");
    doc.text(block.meta, M + badgeW + 4, y + 2.8);
    y += 7.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(block.lines, M + 4, y);
    y += block.lines.length * 4.3 + 2.5;
    doc.setDrawColor(...GRID);
    doc.line(M, y, pageW - M, y);
    y += 5.5;
  }

  footer();

  const safeName = opts.studentName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  doc.save(`DailyWins-Record-${safeName || "student"}-${stamp}.pdf`);
}

// A clean vertical bar chart in a bordered card: dashed gridlines at
// 0/25/50/75/100 with axis labels, rounded bars color-graded exactly like the
// on-screen chart (or per-bar colors when provided), the % printed above each
// bar, the bucket label beneath. Fixed geometry — it cannot bleed.
function drawTimeChart(
  doc: Doc,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    caption: string;
    data: TimeBucket[];
    colors?: RGB[]; // per-bar override (category chart)
    wideBars?: boolean;
  }
) {
  const { x, y, w, h } = opts;

  // Card
  doc.setDrawColor(...BORDER);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");

  // Title + legend
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...NAVY);
  doc.text(opts.title.toUpperCase(), x + 7, y + 10, { charSpace: 0.3 });
  if (!opts.colors) {
    const legend: { label: string; c: RGB }[] = [
      { label: "Strong 80%+", c: GREEN },
      { label: "Mixed 60–79%", c: GOLD },
      { label: "Needs attention", c: CORAL },
    ];
    let lx = x + w - 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    for (let i = legend.length - 1; i >= 0; i--) {
      const item = legend[i];
      const tw = doc.getTextWidth(item.label);
      lx -= tw;
      doc.setTextColor(...GRAY);
      doc.text(item.label, lx, y + 10);
      lx -= 4;
      doc.setFillColor(...item.c);
      doc.circle(lx + 1.4, y + 9, 1.4, "F");
      lx -= 7;
    }
  }

  // Plot area
  const plotX = x + 16;
  const plotW = w - 16 - 9;
  const plotTop = y + 19;
  const plotBottom = y + h - 17;
  const plotH = plotBottom - plotTop;

  if (opts.data.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...GRAY);
    doc.text("No scores recorded in this range yet.", x + w / 2, y + h / 2, { align: "center" });
    return;
  }

  // Gridlines + y labels
  doc.setFontSize(6.8);
  doc.setFont("helvetica", "normal");
  for (const tick of [0, 25, 50, 75, 100]) {
    const gy = plotBottom - (plotH * tick) / 100;
    doc.setTextColor(...GRAY);
    doc.text(`${tick}%`, plotX - 2.5, gy + 1, { align: "right" });
    if (tick === 0) {
      doc.setDrawColor(...BORDER);
      doc.setLineDashPattern([], 0);
    } else {
      doc.setDrawColor(...GRID);
      doc.setLineDashPattern([1.4, 1.6], 0);
    }
    doc.line(plotX, gy, plotX + plotW, gy);
  }
  doc.setLineDashPattern([], 0);

  // Bars. Long compliance ranges can mean 20+ buckets — thin the labels and
  // drop the per-bar % once they'd collide (the axis still carries the scale).
  const n = opts.data.length;
  const slot = plotW / n;
  const barW = Math.min(opts.wideBars ? 18 : 11, slot * 0.58);
  const showPct = n <= 20;
  const labelEvery = Math.max(1, Math.ceil(n / 14));
  opts.data.forEach((d, i) => {
    const cx = plotX + slot * i + slot / 2;
    const bh = Math.max(0.8, (plotH * Math.min(d.pct, 100)) / 100);
    const color = opts.colors ? opts.colors[i % opts.colors.length] : gradeColor(d.pct);
    doc.setFillColor(...color);
    doc.roundedRect(cx - barW / 2, plotBottom - bh, barW, bh, 1.1, 1.1, "F");
    // Flatten the rounded bottom so bars sit square on the axis.
    if (bh > 2.4) {
      doc.rect(cx - barW / 2, plotBottom - 2.2, barW, 2.2, "F");
    }
    if (showPct) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(n > 10 ? 6.6 : 7.4);
      doc.setTextColor(...INK);
      doc.text(`${d.pct}`, cx, plotBottom - bh - 1.6, { align: "center" });
    }
    if (i % labelEvery === 0 || i === n - 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(n > 10 ? 6.4 : 7);
      doc.setTextColor(...GRAY);
      const labelLines = (doc.splitTextToSize(d.label, Math.max(slot * labelEvery - 2, 10)) as string[]).slice(0, 2);
      doc.text(labelLines, cx, plotBottom + 4, { align: "center" });
    }
  });

  // Caption
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...GRAY);
  doc.text(opts.caption, x + 7, y + h - 4);
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

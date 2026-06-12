import type { SupabaseClient } from "@supabase/supabase-js";

// Lazy daily earn (decision: option B in points-economy.md): when a student
// opens their locker, any settled days (yesterday and earlier) since class
// activation that haven't been credited become one `earn` ledger row each.
// Idempotent via the partial unique index points_ledger_daily_earn_guard.
//
// Behavior points are computed the way the dashboard computes them —
// including the arrival option-index rule (see BehaviorCharts.pointsForRaw;
// duplicated here as a plain server module because that one is client-bound).

interface Cat {
  id: string;
  maxPoints?: number;
  noPoints?: boolean;
  type?: string;
  options?: string[];
  pointValues?: number[];
}

function arrivalPointValues(cat: Cat): number[] {
  if (cat.pointValues && cat.pointValues.length > 0) return cat.pointValues;
  const maxPts = cat.maxPoints ?? 3;
  const optCount = cat.options?.length ?? 3;
  return optCount === 3
    ? [maxPts, 0, maxPts]
    : Array.from({ length: optCount }, (_, i) => Math.max(0, maxPts - i));
}

function rowEarned(scores: Record<string, number | null> | null, cats: Cat[]): number {
  if (!scores) return 0;
  let pts = 0;
  for (const cat of cats) {
    if (cat.noPoints) continue;
    const raw = scores[cat.id];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    pts += cat.type === "arrival" ? arrivalPointValues(cat)[raw] ?? 0 : raw;
  }
  return pts;
}

const SCAN_DAYS = 60; // how far back the lazy credit will ever look

export async function creditUncreditedDays(
  admin: SupabaseClient,
  opts: {
    canonicalId: string;
    groupIds: string[]; // canonical group roster rows
    teacherId: string;
    rate: number; // per-class earn rate (decision #7: the only lever)
    activatedAt: string; // ISO date — never credit before activation
  }
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const floorDate = new Date(Date.now() - SCAN_DAYS * 86400_000).toISOString().slice(0, 10);
  const from = opts.activatedAt.slice(0, 10) > floorDate ? opts.activatedAt.slice(0, 10) : floorDate;

  const [{ data: teacher }, { data: rows }] = await Promise.all([
    admin.from("teachers").select("categories").eq("id", opts.teacherId).maybeSingle(),
    admin
      .from("behavior_scores")
      .select("score_date, scores")
      .in("student_id", opts.groupIds)
      .eq("teacher_id", opts.teacherId)
      .gte("score_date", from)
      .lt("score_date", today), // settled days only
  ]);
  if (!rows || rows.length === 0) return;
  const cats = (teacher?.categories ?? []) as Cat[];

  const byDate = new Map<string, number>();
  for (const r of rows) {
    const d = r.score_date as string;
    byDate.set(d, (byDate.get(d) ?? 0) + rowEarned(r.scores as Record<string, number | null>, cats));
  }

  const inserts = [...byDate.entries()]
    .map(([date, points]) => ({
      student_id: opts.canonicalId,
      entry_type: "earn",
      amount: Math.round(points * opts.rate),
      ref: { kind: "daily_earn", date, teacher_id: opts.teacherId, points, rate: opts.rate },
    }))
    .filter((i) => i.amount > 0);
  if (inserts.length === 0) return;

  // Insert one-by-one so a unique-guard conflict (already credited) skips
  // just that day. Volume is tiny (≤ SCAN_DAYS rows once, then ~1/day).
  for (const row of inserts) {
    const { error } = await admin.from("points_ledger").insert(row);
    if (error && !`${error.message}`.includes("duplicate key")) {
      console.error("daily earn insert failed", row.ref, error.message);
    }
  }
}

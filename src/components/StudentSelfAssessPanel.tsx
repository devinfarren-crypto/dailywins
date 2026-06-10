"use client";

// Self-assessment panel for a readwrite STUDENT magic link. The student rates
// their own day per period using the teacher's exact categories; submissions
// go to the separate self_assessments table via the token-validated
// student_self_assess RPC — never into the teacher's behavior_scores, so the
// teacher's record remains the official one ("override" by design).
// Score encoding matches the dashboard: option INDEX for arrival-type
// categories, point value otherwise.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase";

interface WriteCategory {
  id: string;
  name: string;
  type?: string;
  options?: string[];
  pointValues?: number[];
  maxPoints?: number;
  noPoints?: boolean;
}

interface SelfAssessment {
  assess_date: string;
  period: number;
  scores: Record<string, number>;
}

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function storedValue(cat: WriteCategory, optionIndex: number): number {
  return cat.type === "arrival" ? optionIndex : cat.pointValues?.[optionIndex] ?? optionIndex;
}

function optionLabelFor(cat: WriteCategory, raw: number): string {
  const options = cat.options ?? [];
  if (cat.type === "arrival") return options[raw] ?? String(raw);
  const idx = (cat.pointValues ?? []).indexOf(raw);
  return idx >= 0 ? options[idx] ?? String(raw) : String(raw);
}

const card: React.CSSProperties = {
  background: "var(--ssd-surface)",
  border: "1px solid var(--ssd-border)",
  borderRadius: "var(--ssd-radius)",
  padding: "16px",
  marginBottom: 24,
};
const heading: React.CSSProperties = {
  fontFamily: "var(--ssd-font-mono), ui-monospace, monospace",
  margin: "0 0 12px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--ssd-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

export default function StudentSelfAssessPanel({
  token,
  categories,
}: {
  token: string;
  categories?: WriteCategory[] | null;
}) {
  const cats = categories && categories.length > 0 ? categories : [];

  const [period, setPeriod] = useState<number>(1);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [today, setToday] = useState<SelfAssessment[]>([]);

  const loadMine = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("get_self_assessments", { p_raw_token: token });
    if (Array.isArray(data)) {
      const todayStr = new Date().toISOString().slice(0, 10);
      setToday((data as SelfAssessment[]).filter((r) => r.assess_date === todayStr));
    }
  }, [token]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const pick = (cat: WriteCategory, optionIndex: number) => {
    setMsg(null);
    setSelections((s) => ({ ...s, [cat.id]: storedValue(cat, optionIndex) }));
  };

  const save = async () => {
    setMsg(null);
    if (Object.keys(selections).length === 0) {
      setMsg({ ok: false, text: "Pick at least one rating first." });
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("student_self_assess", {
        p_raw_token: token,
        p_period: period,
        p_scores: selections,
      });
      if (error) throw new Error(error.message);
      setMsg({ ok: true, text: `Nice — your Period ${period} self-check is in!` });
      setSelections({});
      loadMine();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={card}>
        <h3 style={heading}>Rate your own day</h3>
        <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", marginBottom: 14 }}>
          How do <em>you</em> think it went? Your teacher sees your self-check next to their own
          record — their record stays the official one.
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14, color: "var(--ssd-text)" }}>
          <span style={{ color: "var(--ssd-text-muted)" }}>Period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            style={{
              border: "1px solid var(--ssd-border)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 14,
              background: "var(--ssd-surface)",
              color: "var(--ssd-ink)",
            }}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        {cats.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ssd-text-muted)" }}>
            Your teacher hasn&apos;t set up rating categories yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cats.map((cat) => {
              const options = cat.options ?? [];
              if (options.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ssd-ink)", marginBottom: 6 }}>
                    {cat.name}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {options.map((opt, i) => {
                      const selected = selections[cat.id] === storedValue(cat, i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => pick(cat, i)}
                          aria-pressed={selected}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            padding: "7px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                            border: `1px solid ${selected ? "var(--ssd-green)" : "var(--ssd-border)"}`,
                            background: selected ? "var(--ssd-green)" : "var(--ssd-surface)",
                            color: selected ? "#fff" : "var(--ssd-text)",
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            marginTop: 16,
            fontSize: 14,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: saving ? "default" : "pointer",
            background: "var(--ssd-green)",
            color: "#fff",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Submit my self-check"}
        </button>
        {msg ? (
          <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "var(--ssd-green-deep)" : "var(--ssd-status-support, #b3541e)" }}>
            {msg.text}
          </div>
        ) : null}

        {today.length > 0 && cats.length > 0 ? (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--ssd-border)", paddingTop: 12 }}>
            <div style={{ ...heading, margin: "0 0 8px" }}>Your self-checks today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {today.map((sa) => (
                <div key={sa.period} style={{ fontSize: 13, color: "var(--ssd-text)" }}>
                  <strong>Period {sa.period}:</strong>{" "}
                  {cats
                    .filter((c) => sa.scores[c.id] !== undefined && sa.scores[c.id] !== null)
                    .map((c) => `${c.name} — ${optionLabelFor(c, sa.scores[c.id])}`)
                    .join(" · ") || "—"}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

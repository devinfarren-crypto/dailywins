"use client";

// Write affordance for a readwrite co-teacher magic link. Lets the co-teacher
// add today's scores for a period and add a shared note — calling the
// SECURITY DEFINER RPCs coteacher_write_score / coteacher_write_note (which
// validate the token, require access='readwrite', and attribute the write to the
// LEAD teacher). The browser anon client can call them (both grant EXECUTE to
// public). After a write we router.refresh() so the server component re-fetches
// get_coteacher_view and the charts/notes above update.
//
// Score encoding matches the dashboard exactly: the stored value is the option
// INDEX for an "arrival"-type category (its pointValues can collide, e.g.
// [3,0,3], so the index disambiguates) and the POINT VALUE for every other type.
// We send only the categories the co-teacher actually set; the RPC merges them
// per-key into today's row, so it won't wipe what the lead teacher entered.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";

interface WriteCategory {
  id: string;
  name: string;
  type?: string; // "arrival" | "scale" | "toggle"
  options?: string[];
  pointValues?: number[];
  maxPoints?: number;
  noPoints?: boolean;
}

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function storedValue(cat: WriteCategory, optionIndex: number): number {
  return cat.type === "arrival" ? optionIndex : cat.pointValues?.[optionIndex] ?? optionIndex;
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

export default function CoteacherWritePanel({
  token,
  categories,
}: {
  token: string;
  categories?: WriteCategory[] | null;
}) {
  const router = useRouter();
  const cats = categories && categories.length > 0 ? categories : [];

  const [period, setPeriod] = useState<number>(1);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [scoreMsg, setScoreMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteMsg, setNoteMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = (cat: WriteCategory, optionIndex: number) => {
    setScoreMsg(null);
    setSelections((s) => ({ ...s, [cat.id]: storedValue(cat, optionIndex) }));
  };

  const saveScores = async () => {
    setScoreMsg(null);
    if (Object.keys(selections).length === 0) {
      setScoreMsg({ ok: false, text: "Pick at least one rating first." });
      return;
    }
    setSavingScores(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("coteacher_write_score", {
        p_raw_token: token,
        p_period: period,
        p_scores: selections,
      });
      if (error) throw new Error(error.message);
      setScoreMsg({ ok: true, text: `Saved Period ${period} for today.` });
      setSelections({});
      router.refresh();
    } catch (e) {
      setScoreMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save scores." });
    } finally {
      setSavingScores(false);
    }
  };

  const saveNote = async () => {
    setNoteMsg(null);
    const content = note.trim();
    if (!content) {
      setNoteMsg({ ok: false, text: "Write something first." });
      return;
    }
    setSavingNote(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("coteacher_write_note", {
        p_raw_token: token,
        p_content: content,
      });
      if (error) throw new Error(error.message);
      setNoteMsg({ ok: true, text: "Shared note added." });
      setNote("");
      router.refresh();
    } catch (e) {
      setNoteMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't add note." });
    } finally {
      setSavingNote(false);
    }
  };

  const msgStyle = (ok: boolean): React.CSSProperties => ({
    marginTop: 10,
    fontSize: 13,
    color: ok ? "var(--ssd-green-deep)" : "var(--ssd-status-support, #b3541e)",
  });

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Scores */}
      <div style={card}>
        <h3 style={heading}>Add today&apos;s scores</h3>

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
            No scoring categories are configured for this student&apos;s teacher yet.
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
          onClick={saveScores}
          disabled={savingScores}
          style={{
            marginTop: 16,
            fontSize: 14,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: savingScores ? "default" : "pointer",
            background: "var(--ssd-green)",
            color: "#fff",
            opacity: savingScores ? 0.6 : 1,
          }}
        >
          {savingScores ? "Saving…" : "Save scores"}
        </button>
        {scoreMsg ? <div style={msgStyle(scoreMsg.ok)}>{scoreMsg.text}</div> : null}
      </div>

      {/* Shared note */}
      <div style={card}>
        <h3 style={heading}>Add a shared note</h3>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteMsg(null);
          }}
          rows={3}
          placeholder="A note the teacher and other co-teachers will see…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid var(--ssd-border)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            color: "var(--ssd-text)",
            resize: "vertical",
          }}
        />
        <div style={{ fontSize: 11, color: "var(--ssd-text-muted)", margin: "6px 0 0" }}>
          Co-teacher notes are always shared (never private).
        </div>
        <button
          type="button"
          onClick={saveNote}
          disabled={savingNote}
          style={{
            marginTop: 12,
            fontSize: 14,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 10,
            border: "none",
            cursor: savingNote ? "default" : "pointer",
            background: "var(--ssd-green)",
            color: "#fff",
            opacity: savingNote ? 0.6 : 1,
          }}
        >
          {savingNote ? "Saving…" : "Add note"}
        </button>
        {noteMsg ? <div style={msgStyle(noteMsg.ok)}>{noteMsg.text}</div> : null}
      </div>
    </div>
  );
}

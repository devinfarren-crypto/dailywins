"use client";

// Teacher's Locker panel: activate → share the class link → hand out combo
// slips → watch wallets. Printable slip sheet uses plain print CSS.

import { useCallback, useEffect, useState } from "react";

interface StudentRow {
  student_id: string;
  display_name: string;
  combo: string;
  claimed: boolean;
  balance: number;
}

interface TeacherState {
  enabled: boolean;
  class_code?: string;
  rate?: number;
  students?: StudentRow[];
}

const C = {
  ink: "#2c3e50",
  green: "#0F6E56",
  teal: "#1D9E75",
  muted: "#8a9690",
  border: "#d8d4c4",
  cream: "#faf7f0",
};

export default function ManageClient() {
  const [state, setState] = useState<TeacherState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [adjusting, setAdjusting] = useState<StudentRow | null>(null);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/locker/teacher");
    if (res.ok) setState(await res.json());
    else setMsg("Couldn't load locker settings.");
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const activate = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/locker/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMsg(`Locker is on — ${data.combos_created} combo slip${data.combos_created === 1 ? "" : "s"} generated.`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdjust = async () => {
    if (!adjusting) return;
    const amount = Number(adjAmount);
    if (!Number.isInteger(amount) || amount === 0 || adjReason.trim().length < 3) {
      setMsg("Adjustment needs a whole non-zero number and a reason.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/locker/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust", student_id: adjusting.student_id, amount, reason: adjReason.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMsg(`Adjusted ${adjusting.display_name} by ${amount > 0 ? "+" : ""}${amount}.`);
      setAdjusting(null);
      setAdjAmount("");
      setAdjReason("");
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <Shell><p style={{ color: C.muted }}>Loading…</p></Shell>;

  if (!state.enabled) {
    return (
      <Shell>
        <h1 style={h1}>The Locker</h1>
        <p style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.6, maxWidth: 560 }}>
          Give every student a digital locker they decorate with points earned from the
          behavior goals you already track. Activating generates a <strong>combo slip</strong> for
          each student on your roster and a class link to share. Spending never touches
          the behavior record — wallets are a separate, append-only bank.
        </p>
        {msg ? <p style={{ color: "#9c3a22", fontWeight: 600, fontSize: 13.5 }}>{msg}</p> : null}
        <button onClick={activate} disabled={busy} style={primaryBtn}>
          {busy ? "Setting up…" : "Activate the Locker for my class"}
        </button>
      </Shell>
    );
  }

  const link = `${typeof window !== "undefined" ? window.location.origin : "https://dailywins.school"}/locker/c/${state.class_code}`;
  const students = state.students ?? [];

  return (
    <Shell>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .slip-grid { display: grid !important; }
        }
        .slip-grid { display: none; grid-template-columns: 1fr 1fr; gap: 10px; }
        .slip { border: 1.5px dashed #999; border-radius: 8px; padding: 12px 14px; page-break-inside: avoid; }
      `}</style>

      <div className="no-print">
        <h1 style={h1}>The Locker — your class</h1>
        {msg ? <p style={{ color: C.green, fontWeight: 600, fontSize: 13.5 }}>{msg}</p> : null}

        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.teal, marginBottom: 6 }}>
            Class locker link — share or post it
          </div>
          <code style={{ fontSize: 13.5, wordBreak: "break-all" }}>{link}</code>
          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button onClick={() => { navigator.clipboard.writeText(link); setMsg("Link copied."); }} style={smallBtn}>
              Copy link
            </button>
            <button onClick={() => window.print()} style={smallBtn}>
              Print combo slips
            </button>
            <button onClick={activate} disabled={busy} style={smallBtn} title="Generates combos for any new students">
              {busy ? "…" : "Refresh combos for new students"}
            </button>
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["Student", "Combo", "Locker", "Wallet", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, padding: "9px 12px", borderBottom: `1px solid ${C.border}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td style={td}>{s.display_name}</td>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{s.combo}</td>
                  <td style={{ ...td, color: s.claimed ? C.green : C.muted, fontWeight: 600 }}>{s.claimed ? "Opened" : "Not yet"}</td>
                  <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>◉ {s.balance}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button onClick={() => setAdjusting(s)} style={{ ...smallBtn, padding: "5px 12px" }}>
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {adjusting ? (
          <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderLeft: `4px solid ${C.green}`, borderRadius: 12, padding: "14px 16px", marginTop: 14, maxWidth: 480 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: C.ink }}>Adjust {adjusting.display_name}&apos;s wallet</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="+25 or -10"
                style={inputStyle}
              />
              <input
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Reason (required, goes in the ledger)"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <button onClick={submitAdjust} disabled={busy} style={{ ...smallBtn, background: C.green, color: "#fff", border: "none" }}>
                Save
              </button>
              <button onClick={() => setAdjusting(null)} style={smallBtn}>
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 12, color: C.muted, margin: "8px 0 0" }}>
              Adjustments are new ledger rows — nothing is ever edited or deleted, and the
              behavior record is untouched.
            </p>
          </div>
        ) : null}

        <p style={{ fontSize: 12.5, color: C.muted, marginTop: 16, maxWidth: 600, lineHeight: 1.55 }}>
          Students earn wallet points automatically from yesterday&apos;s behavior points each
          time they open their locker. Spending is theirs; the official record never changes.
        </p>
      </div>

      {/* print-only slips */}
      <div className="slip-grid">
        {students.map((s) => (
          <div key={s.student_id} className="slip">
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your locker combo</div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 2px" }}>{s.display_name}</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "ui-monospace, monospace", letterSpacing: 2 }}>{s.combo}</div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Open {link.replace(/^https?:\/\//, "")} and spin it in.</div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: "100vh", background: C.cream, padding: "36px 20px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div>
    </main>
  );
}

const h1: React.CSSProperties = { fontSize: 26, fontWeight: 700, color: C.ink, margin: "0 0 10px" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #eee9dc", color: C.ink };
const primaryBtn: React.CSSProperties = {
  marginTop: 14, padding: "13px 26px", borderRadius: 999, border: "none",
  background: C.green, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
};
const smallBtn: React.CSSProperties = {
  padding: "7px 14px", borderRadius: 999, border: `1px solid ${C.border}`,
  background: "#fff", color: C.ink, fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, width: 110,
};

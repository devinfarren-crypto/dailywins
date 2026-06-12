"use client";

// The combo moment: spin three numbers, open the door. First-launch theater
// (the slip is the credential); wrong combo shakes like a real lock.
// Dark-mode register — The Locker is exempt from the Sure Step design system
// (decision #1) but accessibility still floors: AA contrast, reduced motion.

import { useState } from "react";

const INK = "#0f1118";
const PANEL = "#181b25";
const EDGE = "#262b3a";
const TEXT = "#e7e9f0";
const MUTED = "#9aa1b5";
const ACCENT = "#5ad0a2";

export default function ComboClient({ code }: { code: string }) {
  const [nums, setNums] = useState<[string, string, string]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [misses, setMisses] = useState(0);
  const [opening, setOpening] = useState(false);

  const setNum = (i: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    setNums((prev) => {
      const next = [...prev] as [string, string, string];
      next[i] = clean;
      return next;
    });
    if (clean.length === 2 && i < 2) {
      document.getElementById(`combo-${i + 1}`)?.focus();
    }
  };

  const submit = async () => {
    if (nums.some((n) => n === "")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/locker/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, combo: nums.join("-") }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMisses((m) => m + 1);
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setError(
          data.error === "unknown_class"
            ? "This locker link isn't active. Ask your teacher for the current one."
            : misses >= 1
              ? "Still not it — ask your teacher to check your combo slip."
              : "That's not it. Check your slip and try again."
        );
        return;
      }
      setOpening(true);
      setTimeout(() => {
        window.location.href = "/locker";
      }, 700);
    } catch {
      setError("Couldn't reach the locker. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(80% 60% at 50% 20%, #1b2030 0%, ${INK} 70%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: TEXT,
      }}
    >
      <style>{`
        @keyframes lockerShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-9px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(4px)} }
        @keyframes doorOpen { to { transform: perspective(900px) rotateY(-68deg); opacity:.25 } }
        .combo-card.shake { animation: lockerShake .45s ease; }
        .combo-card.open { animation: doorOpen .7s ease forwards; transform-origin: left center; }
        @media (prefers-reduced-motion: reduce) {
          .combo-card.shake { animation: none; }
          .combo-card.open { animation: none; opacity: .25; transition: opacity .4s; }
        }
        .combo-input:focus { outline: 3px solid ${ACCENT}; outline-offset: 2px; }
      `}</style>

      <div
        className={`combo-card${shake ? " shake" : ""}${opening ? " open" : ""}`}
        style={{
          width: "min(380px, 92vw)",
          background: `linear-gradient(180deg, ${PANEL}, #141722)`,
          border: `1px solid ${EDGE}`,
          borderRadius: 18,
          padding: "34px 28px 30px",
          boxShadow: "0 30px 80px rgba(0,0,0,.55)",
          textAlign: "center",
        }}
      >
        {/* vents */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center", marginBottom: 22 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 120, height: 5, borderRadius: 3, background: "#0a0c12", boxShadow: "inset 0 1px 2px #000" }} />
          ))}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px", letterSpacing: 0.3 }}>
          Your locker.
        </h1>
        <p style={{ color: MUTED, fontSize: 13.5, margin: "0 0 24px", lineHeight: 1.5 }}>
          Spin in the three numbers from your combo slip.
        </p>

        {/* dial */}
        <div
          aria-hidden="true"
          style={{
            width: 86,
            height: 86,
            margin: "0 auto 22px",
            borderRadius: "50%",
            background: "conic-gradient(#2a2f40 0 10%, #1d212e 10% 20%, #2a2f40 20% 30%, #1d212e 30% 40%, #2a2f40 40% 50%, #1d212e 50% 60%, #2a2f40 60% 70%, #1d212e 70% 80%, #2a2f40 80% 90%, #1d212e 90% 100%)",
            border: "5px solid #3a4156",
            boxShadow: "inset 0 4px 14px rgba(0,0,0,.7), 0 4px 10px rgba(0,0,0,.4)",
            position: "relative",
            transform: `rotate(${(Number(nums[0] || 0) + Number(nums[1] || 0) + Number(nums[2] || 0)) * 9}deg)`,
            transition: "transform .35s cubic-bezier(.22,1,.36,1)",
          }}
        >
          <div style={{ position: "absolute", top: 5, left: "50%", width: 4, height: 14, marginLeft: -2, background: ACCENT, borderRadius: 2 }} />
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              id={`combo-${i}`}
              className="combo-input"
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Combo number ${i + 1}`}
              value={nums[i]}
              onChange={(e) => setNum(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="00"
              style={{
                width: 64,
                height: 64,
                textAlign: "center",
                fontSize: 26,
                fontWeight: 800,
                color: TEXT,
                background: "#0d0f16",
                border: `1px solid ${EDGE}`,
                borderRadius: 12,
                fontVariantNumeric: "tabular-nums",
              }}
            />
          ))}
        </div>

        {error ? (
          <p role="alert" style={{ color: "#ff9d8a", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
        ) : null}

        <button
          onClick={submit}
          disabled={busy || opening || nums.some((n) => n === "")}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 12,
            border: "none",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 0.4,
            cursor: busy ? "wait" : "pointer",
            color: "#08110d",
            background: ACCENT,
            opacity: busy || nums.some((n) => n === "") ? 0.55 : 1,
          }}
        >
          {opening ? "Opening…" : busy ? "Checking…" : "Open locker"}
        </button>

        <p style={{ color: "#6b7288", fontSize: 11.5, marginTop: 16 }}>
          Lost your slip? Your teacher has your combo.
        </p>
      </div>
    </main>
  );
}

"use client";

// The director's launch sequence — one focused step at a time on a NAVY STAGE
// (the brand's splash-screen moment), a progress bar that visibly fills, and a
// small earned celebration after each step. A director should be WALKED into
// their school, not handed a manual.
//
// Visual system (Sure_Step_Education_Aesthetic.md): navy #1a1a2e field with
// the amber growth curve as the stage; white card; mist #E1F5EE highlights;
// forest #0F6E56 actions; amber #EF9F27 eyebrows/accents.
//
// Steps auto-complete from live data, progress persists per-school in
// localStorage, and once finished the page becomes a compact mission-control
// view with a "Replay setup" escape hatch.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/src/lib/supabase";
import CopyBlock from "./CopyBlock";
import AdminNavyBand from "@/src/components/AdminNavyBand";

interface LaunchProps {
  schoolId: string;
  schoolName: string;
  isNps: boolean;
  userEmail: string;
  initial: {
    teacherCount: number;
    studentCount: number;
    hasSchedule: boolean;
    linksOn: number;
  };
}

type StepKey = "meet" | "teacher" | "schedule" | "links" | "records";

const EASE = "cubic-bezier(.22,1,.36,1)";
const NAVY = "#1a1a2e";
const NAVY_SOFT = "#2a2b48";
const FOREST = "#0F6E56";
const TEAL = "#1D9E75";
const TEAL_LIGHT = "#5DCAA5";
const MIST = "#E1F5EE";
const AMBER = "#EF9F27";

function storageKey(schoolId: string) {
  return `dw-launch-${schoolId}`;
}

// ── shared styles ────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  padding: "34px 36px",
  boxShadow: "0 24px 60px rgba(10,10,20,.45)",
  maxWidth: 620,
  margin: "0 auto",
};
const eyebrowStyle: React.CSSProperties = {
  fontFamily: "var(--ssd-font-mono), monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: AMBER,
  marginBottom: 10,
};
const titleStyle: React.CSSProperties = {
  fontFamily: "var(--ssd-font-display), Georgia, serif",
  fontSize: 27,
  fontWeight: 500,
  color: NAVY,
  margin: "0 0 10px",
  lineHeight: 1.15,
};
const bodyStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.6,
  color: "#4a4a5e",
  margin: "0 0 22px",
};
const primaryBtn: React.CSSProperties = {
  background: FOREST,
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "13px 28px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(15,110,86,.35)",
  transition: "transform .15s ease, background .15s ease",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: TEAL,
  border: "none",
  padding: "10px 8px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

export default function LaunchClient({ schoolId, schoolName, isNps, userEmail, initial }: LaunchProps) {
  const steps: StepKey[] = useMemo(
    () => (isNps ? ["meet", "teacher", "schedule", "links", "records"] : ["meet", "teacher", "schedule", "links"]),
    [isNps]
  );

  const autoDone = useMemo(() => {
    const d = new Set<StepKey>();
    if (initial.teacherCount > 0) d.add("teacher");
    if (initial.hasSchedule) d.add("schedule");
    return d;
  }, [initial]);

  const [mounted, setMounted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<StepKey>>(new Set(autoDone));
  const [idx, setIdx] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [entering, setEntering] = useState(true);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(schoolId)) ?? "{}");
      const savedDone: StepKey[] = Array.isArray(saved.done) ? saved.done : [];
      const merged = new Set<StepKey>([...autoDone, ...savedDone]);
      setDoneSteps(merged);
      if (saved.finished) {
        setFinished(true);
      } else {
        const firstOpen = steps.findIndex((s) => !merged.has(s));
        setIdx(firstOpen === -1 ? steps.length : Math.max(0, firstOpen));
        if (firstOpen === -1) setFinished(true);
      }
    } catch {
      // fresh start
    }
    setMounted(true);
  }, [schoolId, autoDone, steps]);

  function persist(nextDone: Set<StepKey>, nextFinished: boolean) {
    try {
      localStorage.setItem(
        storageKey(schoolId),
        JSON.stringify({ done: Array.from(nextDone), finished: nextFinished })
      );
    } catch {
      // private mode — progress just won't persist
    }
  }

  function completeStep(step: StepKey) {
    const nextDone = new Set(doneSteps);
    nextDone.add(step);
    setDoneSteps(nextDone);
    const isLast = idx >= steps.length - 1;
    persist(nextDone, isLast);
    if (reducedMotion.current) {
      if (isLast) setFinished(true);
      else setIdx(idx + 1);
      return;
    }
    setCelebrating(true);
    setTimeout(() => {
      setCelebrating(false);
      if (isLast) {
        setFinished(true);
      } else {
        setEntering(false);
        setIdx(idx + 1);
        requestAnimationFrame(() => requestAnimationFrame(() => setEntering(true)));
      }
    }, 900);
  }

  function replay() {
    persist(new Set(), false);
    setDoneSteps(new Set(autoDone));
    setFinished(false);
    setIdx(0);
    setEntering(true);
  }

  if (!mounted) {
    return <div style={{ minHeight: 420 }} />;
  }

  const progress = Math.round((doneSteps.size / steps.length) * 100);

  if (finished) {
    return <MissionControl schoolName={schoolName} isNps={isNps} userEmail={userEmail} initial={initial} onReplay={replay} />;
  }

  const step = steps[Math.min(idx, steps.length - 1)];

  return (
    <div>
      <style>{`
        @keyframes dwPop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes dwRise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
        @keyframes dwBarGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        .dw-bar { transform-box: fill-box; transform-origin: bottom; animation: dwBarGrow .6s ${EASE} both; }
        .dw-primary:hover { transform: translateY(-1px); background: ${TEAL} !important; }
        @media (prefers-reduced-motion: reduce) {
          .dw-bar { animation: none }
          .dw-primary:hover { transform: none }
        }
      `}</style>

      {/* ── The navy stage ── */}
      <div
        style={{
          position: "relative",
          borderRadius: 24,
          background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_SOFT} 100%)`,
          padding: "36px 28px 44px",
          overflow: "hidden",
        }}
      >
        {/* ghosted brand curve, decoration only */}
        <svg
          viewBox="0 0 200 200"
          aria-hidden="true"
          style={{ position: "absolute", right: -30, bottom: -40, width: 300, height: 300, opacity: 0.1, pointerEvents: "none" }}
        >
          <rect x="38" y="120" width="22" height="40" rx="3" fill={TEAL_LIGHT} />
          <rect x="68" y="98" width="22" height="62" rx="3" fill={TEAL_LIGHT} />
          <rect x="98" y="74" width="22" height="86" rx="3" fill={TEAL_LIGHT} />
          <rect x="128" y="48" width="22" height="112" rx="3" fill={TEAL_LIGHT} />
          <path d="M38 150 C 78 124, 128 100, 158 36" stroke={AMBER} strokeWidth="5" strokeLinecap="round" fill="none" />
        </svg>

        {/* Progress */}
        <div style={{ maxWidth: 620, margin: "0 auto 20px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "var(--ssd-font-mono), monospace",
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: TEAL_LIGHT,
              }}
            >
              Launching {schoolName} · step {Math.min(idx + 1, steps.length)} of {steps.length}
            </span>
            <span style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 13, color: AMBER, fontWeight: 700 }}>
              {progress}%
            </span>
          </div>
          <div style={{ position: "relative", height: 8, borderRadius: 999, background: "rgba(255,255,255,.14)" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max(progress, 3)}%`,
                borderRadius: 999,
                background: `linear-gradient(90deg, ${TEAL} 0%, ${TEAL_LIGHT} 100%)`,
                transition: `width .7s ${EASE}`,
              }}
            />
            {/* the amber dot rides the leading edge — the growth curve's dot */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${Math.max(progress, 3)}%`,
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: AMBER,
                boxShadow: `0 0 0 4px rgba(239,159,39,.25)`,
                transition: `left .7s ${EASE}`,
              }}
            />
          </div>
          {/* step dots */}
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {steps.map((s, i) => (
              <div
                key={s}
                style={{
                  height: 4,
                  flex: 1,
                  borderRadius: 999,
                  background: doneSteps.has(s) ? TEAL_LIGHT : i === idx ? AMBER : "rgba(255,255,255,.18)",
                  transition: "background .4s ease",
                }}
              />
            ))}
          </div>
        </div>

        {/* The one card */}
        <div
          style={{
            ...cardStyle,
            position: "relative",
            opacity: entering ? 1 : 0,
            transform: entering ? "none" : "translateY(16px)",
            transition: `opacity .45s ${EASE}, transform .45s ${EASE}`,
          }}
        >
          {celebrating ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: NAVY,
                borderRadius: 18,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 5,
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: TEAL,
                  color: "#fff",
                  fontSize: 34,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "dwPop .45s ease both",
                  boxShadow: `0 0 0 8px rgba(29,158,117,.25)`,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  fontFamily: "var(--ssd-font-display), Georgia, serif",
                  fontSize: 20,
                  color: "#fff",
                  animation: "dwRise .4s ease .1s both",
                }}
              >
                {idx >= steps.length - 1 ? "That's everything." : "Nice — next."}
              </div>
            </div>
          ) : null}

          {step === "meet" && <MeetStep schoolName={schoolName} isNps={isNps} onDone={() => completeStep("meet")} />}
          {step === "teacher" && <TeacherStep already={initial.teacherCount} onDone={() => completeStep("teacher")} />}
          {step === "schedule" && <ScheduleStep onDone={() => completeStep("schedule")} />}
          {step === "links" && <LinksStep schoolId={schoolId} onDone={() => completeStep("links")} />}
          {step === "records" && <RecordsStep onDone={() => completeStep("records")} />}
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "rgba(255,255,255,.45)", position: "relative" }}>
          Everything here lives in the tabs above too — this walkthrough is just the fast way in.
        </p>
      </div>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function MeetStep({ schoolName, isNps, onDone }: { schoolName: string; isNps: boolean; onDone: () => void }) {
  const beats = [
    ["Teachers tap.", "Each period: tap the goals each student met. ~30 seconds, any device, their own goal labels."],
    ["The record builds itself.", "Every tap is a dated data point — charts grade themselves daily, weekly, monthly."],
    ["Reports are one click.", "IEP-ready PDF progress reports, legible even on a black-and-white copier."],
    ...(isNps
      ? [["You see everything.", "Any student's full record — every score and note in your school, access audited."]]
      : []),
  ];
  const accents = [TEAL, AMBER, FOREST, NAVY];
  const [revealed, setRevealed] = useState(1);
  const allShown = revealed >= beats.length;
  return (
    <div>
      <div style={eyebrowStyle}>Welcome, Director</div>
      <h2 style={titleStyle}>{schoolName} is about to get very easy to run.</h2>
      <p style={bodyStyle}>Four things to know — that&apos;s the whole product.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
        {beats.slice(0, revealed).map(([head, rest], i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: MIST,
              borderLeft: `4px solid ${accents[i % accents.length]}`,
              borderRadius: 12,
              padding: "12px 14px",
              animation: "dwRise .4s ease both",
            }}
          >
            <span
              style={{
                fontFamily: "var(--ssd-font-mono), monospace",
                fontSize: 12,
                color: FOREST,
                fontWeight: 700,
                paddingTop: 2,
                flexShrink: 0,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "#2a3540" }}>
              <strong style={{ color: NAVY }}>{head}</strong> {rest}
            </span>
          </div>
        ))}
      </div>
      {allShown ? (
        <button className="dw-primary" style={primaryBtn} onClick={onDone}>
          That&apos;s all I need — let&apos;s build it →
        </button>
      ) : (
        <button className="dw-primary" style={primaryBtn} onClick={() => setRevealed((r) => r + 1)}>
          {revealed === 1 ? "Tell me more" : "And?"}
        </button>
      )}
    </div>
  );
}

function TeacherStep({ already, onDone }: { already: number; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invite-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Invite failed");
      setSentTo(body.email ?? email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={eyebrowStyle}>Step · Your first teacher</div>
      <h2 style={titleStyle}>{already > 0 ? "Invite another teacher." : "Bring in your first teacher."}</h2>
      <p style={bodyStyle}>
        Type their school email. They get <strong style={{ color: NAVY }}>one</strong> email with a
        one-click sign-in button — no installs, no passwords, no setup on their end. Most teachers
        are tracking their first class period the same day.
      </p>
      {sentTo ? (
        <div
          style={{
            background: MIST,
            borderLeft: `4px solid ${TEAL}`,
            borderRadius: 12,
            padding: "13px 15px",
            fontSize: 14,
            color: "#2a3540",
            marginBottom: 20,
            animation: "dwRise .4s ease both",
          }}
        >
          ✉️ Invite is in <strong style={{ color: NAVY }}>{sentTo}</strong>&apos;s inbox. You can add
          the rest of your staff any time from the Teachers tab.
        </div>
      ) : (
        <form onSubmit={invite} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@yourschool.org"
            style={{
              flex: 1,
              minWidth: 220,
              fontSize: 14,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1.5px solid ${TEAL_LIGHT}`,
              background: "#fff",
              color: NAVY,
              outlineColor: TEAL,
            }}
          />
          <button type="submit" disabled={busy} className="dw-primary" style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Sending…" : "Send the invite"}
          </button>
        </form>
      )}
      {error ? <p style={{ fontSize: 13, color: "#dd6b4d", fontWeight: 600, margin: "0 0 14px" }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {sentTo ? (
          <button className="dw-primary" style={primaryBtn} onClick={onDone}>
            Teacher one: done →
          </button>
        ) : (
          <button style={ghostBtn} onClick={onDone}>
            I&apos;ll invite teachers later
          </button>
        )}
      </div>
    </div>
  );
}

function ScheduleStep({ onDone }: { onDone: () => void }) {
  return (
    <div>
      <div style={eyebrowStyle}>Step · Your bell schedule</div>
      <h2 style={titleStyle}>Make the day look like your day.</h2>
      <p style={bodyStyle}>
        Upload your bell schedule — a PDF is perfect, it&apos;s read automatically — and every
        teacher&apos;s grid shows your real periods. No schedule handy? A standard 8-period day is
        already in place and works fine until you&apos;re ready.
      </p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/admin/upload-schedule" className="dw-primary" style={{ ...primaryBtn, textDecoration: "none", display: "inline-block" }}>
          Upload my schedule
        </a>
        <button style={ghostBtn} onClick={onDone}>
          The default day is fine for now →
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#7a7a8e", marginTop: 16 }}>
        (If you upload, come back to the Home tab — your progress here is saved.)
      </p>
    </div>
  );
}

function LinksStep({ schoolId, onDone }: { schoolId: string; onDone: () => void }) {
  type Settings = { parent: boolean; student: boolean; co_teacher: boolean };
  const [settings, setSettings] = useState<Settings>({ parent: true, student: true, co_teacher: true });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_school_link_settings", { p_school_id: schoolId });
      if (data) {
        setSettings({
          parent: data.parent !== false,
          student: data.student !== false,
          co_teacher: data.co_teacher !== false,
        });
      }
      setLoaded(true);
    })();
  }, [schoolId]);

  async function lockIn() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_school_link_settings", {
      p_school_id: schoolId,
      p_settings: settings,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  }

  const rows: { key: keyof Settings; label: string; hint: string }[] = [
    { key: "parent", label: "Parents & guardians", hint: "read-only progress view, no account needed" },
    { key: "student", label: "Students", hint: "their own wins; optional self-assessment" },
    { key: "co_teacher", label: "Co-teachers & paras", hint: "classroom team view, optional contributions" },
  ];

  return (
    <div>
      <div style={eyebrowStyle}>Step · Your call</div>
      <h2 style={titleStyle}>Who can teachers share progress with?</h2>
      <p style={bodyStyle}>
        Teachers can send secure progress links — no accounts, no app. Some schools love this on day
        one, some wait. Whatever you choose is enforced school-wide, and you can change it any time.{" "}
        <strong style={{ color: NAVY }}>This is your switchboard.</strong>
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22, opacity: loaded ? 1 : 0.4 }}>
        {rows.map((r) => (
          <button
            key={r.key}
            disabled={!loaded || busy}
            onClick={() => setSettings((s) => ({ ...s, [r.key]: !s[r.key] }))}
            aria-pressed={settings[r.key]}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              textAlign: "left",
              background: settings[r.key] ? MIST : "#fff",
              border: `1.5px solid ${settings[r.key] ? TEAL : "#d9d4c5"}`,
              borderRadius: 12,
              padding: "13px 15px",
              cursor: "pointer",
              transition: "background .2s ease, border-color .2s ease",
            }}
          >
            <span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: NAVY }}>{r.label}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "#7a7a8e" }}>{r.hint}</span>
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "5px 14px",
                borderRadius: 999,
                background: settings[r.key] ? TEAL : "#ebe7da",
                color: settings[r.key] ? "#fff" : "#7a7a8e",
                flexShrink: 0,
                transition: "background .2s ease",
              }}
            >
              {settings[r.key] ? "ON" : "OFF"}
            </span>
          </button>
        ))}
      </div>
      {error ? <p style={{ fontSize: 13, color: "#dd6b4d", fontWeight: 600, margin: "0 0 14px" }}>{error}</p> : null}
      <button
        className="dw-primary"
        style={{ ...primaryBtn, opacity: busy || !loaded ? 0.6 : 1 }}
        disabled={busy || !loaded}
        onClick={lockIn}
      >
        {busy ? "Saving…" : "Lock in my policy →"}
      </button>
    </div>
  );
}

function RecordsStep({ onDone }: { onDone: () => void }) {
  return (
    <div>
      <div style={eyebrowStyle}>Step · Your superpower</div>
      <h2 style={titleStyle}>You can always see the whole story.</h2>
      <p style={bodyStyle}>
        The <strong style={{ color: NAVY }}>Student records</strong> tab opens any student&apos;s
        complete record — every score, every note from every teacher (shared and private), charted
        over time. When a placing district calls, the answer is one click, not a weekend of binders.
        Every record you open is logged, so your school&apos;s access trail is airtight too.
      </p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="dw-primary" style={primaryBtn} onClick={onDone}>
          Understood — finish launch →
        </button>
        <a href="/admin/records" style={ghostBtn as React.CSSProperties}>
          Peek at it now
        </a>
      </div>
    </div>
  );
}

// ── Finale / steady-state ────────────────────────────────────────────────────

function MissionControl({
  schoolName,
  isNps,
  userEmail,
  initial,
  onReplay,
}: {
  schoolName: string;
  isNps: boolean;
  userEmail: string;
  initial: LaunchProps["initial"];
  onReplay: () => void;
}) {
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState("");

  // "What teachers see": seed a [DEMO] class on the director's own teacher
  // dashboard, then open it in a new tab so this home stays put.
  const openDemo = async () => {
    setDemoBusy(true);
    setDemoErr("");
    try {
      const res = await fetch("/api/admin/demo-dashboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Couldn't set up the demo. Try again.");
      }
      window.open("/dashboard", "_blank", "noopener");
    } catch (err) {
      setDemoErr(err instanceof Error ? err.message : "Couldn't set up the demo. Try again.");
    } finally {
      setDemoBusy(false);
    }
  };

  const teacherBlurb = [
    `Hi team — we're starting with DailyWins (dailywins.school), a behavior/goal tracker built by teachers.`,
    ``,
    `What it asks of you: about 30 seconds per class period. Your roster appears as a grid — tap to mark each goal a student met. That's it. No save button, no syncing, no binder.`,
    ``,
    `What you get back: daily/weekly/monthly progress charts that build themselves, printable progress reports for meetings, and (if enabled) secure links for parents — no parent accounts needed.`,
    ``,
    `Getting in: you'll receive an email from DailyWins with a one-click sign-in button. Click it and you're in — add your students (paste a list of names) and customize your five goal labels to match how you track.`,
    ``,
    `Phones, tablets, Chromebooks all work. Questions → ${userEmail}`,
  ].join("\n");

  const stats = [
    { label: "Teachers", value: initial.teacherCount, href: "/admin/teachers", accent: TEAL },
    { label: "Students tracked", value: initial.studentCount, href: "/admin/usage", accent: AMBER },
    { label: "Bell schedule", value: initial.hasSchedule ? "Set" : "Default day", href: "/admin/upload-schedule", accent: FOREST },
    { label: "Link types on", value: `${initial.linksOn}/3`, href: "/admin/links", accent: NAVY },
  ];

  return (
    <div>
      <style>{`
        .dw-tile:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,38,61,.12); }
        @media (prefers-reduced-motion: reduce) { .dw-tile:hover { transform: none } }
      `}</style>

      {/* The shared admin band — same component, same spot, on every tab. */}
      <AdminNavyBand
        title={`${schoolName} is live.`}
        sub={isNps ? "Yours to run — every tab above." : "Every tab above, whenever you need it."}
        action={
          <button
            onClick={onReplay}
            style={{
              background: "transparent",
              color: TEAL_LIGHT,
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              flexShrink: 0,
            }}
          >
            Replay setup
          </button>
        }
      />

      {/* live tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="dw-tile"
            style={{
              background: "#fff",
              border: "1px solid var(--ssd-border)",
              borderTop: `4px solid ${s.accent}`,
              borderRadius: 14,
              padding: "16px 18px",
              textDecoration: "none",
              transition: "transform .15s ease, box-shadow .15s ease",
            }}
          >
            <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 26, color: NAVY }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: "#7a7a8e" }}>{s.label}</div>
          </a>
        ))}
      </div>

      {/* What teachers see — a hands-on demo dashboard, fake students only. */}
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--ssd-border)",
          borderRadius: 18,
          padding: "22px 24px",
          boxShadow: "0 6px 16px rgba(26,38,61,.07)",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <div
            style={{
              fontFamily: "var(--ssd-font-mono), monospace",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: TEAL,
              marginBottom: 6,
              fontWeight: 700,
            }}
          >
            What teachers see
          </div>
          <div style={{ fontSize: 13, color: "#7a7a8e", lineHeight: 1.55 }}>
            Open your own teacher dashboard, pre-loaded with seven fake students and 8 weeks of
            history — tap scores, open the charts, print a progress report. Everything is tagged{" "}
            <strong>[DEMO]</strong> and wipeable from the dashboard&apos;s settings; no real student
            data is touched. Opens in a new tab.
          </div>
          {demoErr ? (
            <div style={{ fontSize: 13, color: "#9c3a22", fontWeight: 600, marginTop: 8 }}>
              {demoErr}
            </div>
          ) : null}
        </div>
        <button
          className="dw-primary"
          style={{ ...primaryBtn, opacity: demoBusy ? 0.7 : 1, cursor: demoBusy ? "wait" : "pointer", flexShrink: 0 }}
          onClick={openDemo}
          disabled={demoBusy}
        >
          {demoBusy ? "Setting up your demo class…" : "Open the demo dashboard →"}
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--ssd-border)",
          borderRadius: 18,
          padding: "22px 24px",
          boxShadow: "0 6px 16px rgba(26,38,61,.07)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--ssd-font-mono), monospace",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: AMBER,
            marginBottom: 6,
            fontWeight: 700,
          }}
        >
          Send this to your teachers
        </div>
        <div style={{ fontSize: 13, color: "#7a7a8e", marginBottom: 12 }}>
          A ready-to-send staff note — then invite them from the Teachers tab and the sign-in button
          lands in their inbox.
        </div>
        <CopyBlock text={teacherBlurb} />
      </div>
    </div>
  );
}

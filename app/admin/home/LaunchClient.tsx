"use client";

// The director's launch sequence — one focused step at a time, a progress bar
// that visibly fills, and a small earned moment after each step. Replaces the
// text-heavy checklist: a director should be WALKED into their school, not
// handed a manual. Professional, but it should feel like progress.
//
// Steps auto-complete from live data (a school that already has teachers skips
// ahead), progress persists per-school in localStorage, and once the sequence
// finishes the page becomes a compact mission-control view with a "Replay
// setup" escape hatch.

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/src/lib/supabase";
import CopyBlock from "./CopyBlock";

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

function storageKey(schoolId: string) {
  return `dw-launch-${schoolId}`;
}

// ── tiny shared styles ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: "var(--ssd-surface)",
  border: "1px solid var(--ssd-border)",
  borderRadius: "var(--ssd-radius-lg, 18px)",
  padding: "34px 36px",
  boxShadow: "0 18px 50px rgba(26,26,46,.08)",
  maxWidth: 640,
  margin: "0 auto",
};
const eyebrowStyle: React.CSSProperties = {
  fontFamily: "var(--ssd-font-mono), monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ssd-green)",
  marginBottom: 10,
};
const titleStyle: React.CSSProperties = {
  fontFamily: "var(--ssd-font-display), Georgia, serif",
  fontSize: 27,
  fontWeight: 500,
  color: "var(--ssd-ink)",
  margin: "0 0 10px",
  lineHeight: 1.15,
};
const bodyStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.6,
  color: "var(--ssd-text-muted)",
  margin: "0 0 22px",
};
const primaryBtn: React.CSSProperties = {
  background: "var(--ssd-green-deep)",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  padding: "12px 26px",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--ssd-text-muted)",
  border: "none",
  padding: "10px 8px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

export default function LaunchClient({ schoolId, schoolName, isNps, userEmail, initial }: LaunchProps) {
  const steps: StepKey[] = useMemo(
    () => (isNps ? ["meet", "teacher", "schedule", "links", "records"] : ["meet", "teacher", "schedule", "links"]),
    [isNps]
  );

  // Live-data auto-completion: a returning director with teachers already on
  // board shouldn't be asked to "invite your first teacher" again.
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
    }, 850);
  }

  function replay() {
    persist(new Set(), false);
    setDoneSteps(new Set(autoDone));
    setFinished(false);
    setIdx(0);
    setEntering(true);
  }

  if (!mounted) {
    return <div style={{ minHeight: 320 }} />;
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
      `}</style>

      {/* Progress: step dots + filling bar */}
      <div style={{ maxWidth: 640, margin: "0 auto 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <span style={{ ...eyebrowStyle, marginBottom: 0 }}>
            Launching {schoolName} · step {Math.min(idx + 1, steps.length)} of {steps.length}
          </span>
          <span style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, color: "var(--ssd-green-deep)", fontWeight: 700 }}>
            {progress}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--ssd-surface-alt)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.max(progress, 4)}%`,
              borderRadius: 999,
              background: "linear-gradient(90deg, var(--ssd-green), var(--ssd-green-deep))",
              transition: `width .7s ${EASE}`,
            }}
          />
        </div>
      </div>

      {/* The one card */}
      <div
        style={{
          ...cardStyle,
          position: "relative",
          opacity: entering ? 1 : 0,
          transform: entering ? "none" : "translateY(14px)",
          transition: `opacity .45s ${EASE}, transform .45s ${EASE}`,
        }}
      >
        {celebrating ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--ssd-surface)",
              borderRadius: "var(--ssd-radius-lg, 18px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 5,
              gap: 10,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--ssd-green)",
                color: "#fff",
                fontSize: 32,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "dwPop .45s ease both",
              }}
            >
              ✓
            </div>
            <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 19, color: "var(--ssd-ink)", animation: "dwRise .4s ease .1s both" }}>
              {idx >= steps.length - 1 ? "That's everything." : "Nice — next."}
            </div>
          </div>
        ) : null}

        {step === "meet" && <MeetStep schoolName={schoolName} isNps={isNps} onDone={() => completeStep("meet")} />}
        {step === "teacher" && (
          <TeacherStep
            already={initial.teacherCount}
            onDone={() => completeStep("teacher")}
          />
        )}
        {step === "schedule" && <ScheduleStep onDone={() => completeStep("schedule")} />}
        {step === "links" && <LinksStep schoolId={schoolId} onDone={() => completeStep("links")} />}
        {step === "records" && <RecordsStep onDone={() => completeStep("records")} />}
      </div>

      <p style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--ssd-text-muted)" }}>
        Everything here lives in the tabs above too — this walkthrough is just the fast way in.
      </p>
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
              background: "var(--ssd-paper)",
              border: "1px solid var(--ssd-border)",
              borderRadius: 12,
              padding: "12px 14px",
              animation: "dwRise .4s ease both",
            }}
          >
            <span style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, color: "var(--ssd-green-deep)", fontWeight: 700, paddingTop: 2 }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ssd-text)" }}>
              <strong style={{ color: "var(--ssd-ink)" }}>{head}</strong> {rest}
            </span>
          </div>
        ))}
      </div>
      {allShown ? (
        <button style={primaryBtn} onClick={onDone}>That&apos;s all I need — let&apos;s build it →</button>
      ) : (
        <button style={primaryBtn} onClick={() => setRevealed((r) => r + 1)}>
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
      <h2 style={titleStyle}>{already > 0 ? "Invite another teacher" : "Bring in your first teacher."}</h2>
      <p style={bodyStyle}>
        Type their school email. They get <strong style={{ color: "var(--ssd-ink)" }}>one</strong> email
        with a one-click sign-in button — no installs, no passwords, no setup on their end. Most
        teachers are tracking their first class period the same day.
      </p>
      {sentTo ? (
        <div style={{ background: "var(--ssd-surface-alt)", borderLeft: "3px solid var(--ssd-green)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "var(--ssd-text)", marginBottom: 20 }}>
          ✉️ Invite is in <strong>{sentTo}</strong>&apos;s inbox. You can add the rest of your staff
          any time from the Teachers tab.
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
              padding: "11px 14px",
              borderRadius: 10,
              border: "1px solid var(--ssd-border)",
              background: "var(--ssd-paper)",
              color: "var(--ssd-text)",
            }}
          />
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Sending…" : "Send the invite"}
          </button>
        </form>
      )}
      {error ? <p style={{ fontSize: 13, color: "var(--ssd-status-support)", margin: "0 0 14px" }}>{error}</p> : null}
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {sentTo ? (
          <button style={primaryBtn} onClick={onDone}>Teacher one: done →</button>
        ) : (
          <button style={ghostBtn} onClick={onDone}>I&apos;ll invite teachers later</button>
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
        teacher&apos;s grid shows your real periods. No schedule yet? No problem: a standard
        8-period day is already in place and works fine until you&apos;re ready.
      </p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/admin/upload-schedule" style={{ ...primaryBtn, textDecoration: "none", display: "inline-block" }}>
          Upload my schedule
        </a>
        <button style={ghostBtn} onClick={onDone}>The default day is fine for now →</button>
      </div>
      <p style={{ fontSize: 12, color: "var(--ssd-text-muted)", marginTop: 16 }}>
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
        Teachers can send secure progress links — no accounts, no app. Some schools love this on
        day one, some wait. Whatever you choose is enforced school-wide, and you can change it
        any time. <strong style={{ color: "var(--ssd-ink)" }}>This is your switchboard.</strong>
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
              background: settings[r.key] ? "var(--ssd-paper)" : "var(--ssd-surface)",
              border: `1.5px solid ${settings[r.key] ? "var(--ssd-green)" : "var(--ssd-border)"}`,
              borderRadius: 12,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--ssd-ink)" }}>{r.label}</span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--ssd-text-muted)" }}>{r.hint}</span>
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: 999,
                background: settings[r.key] ? "var(--ssd-green)" : "var(--ssd-surface-alt)",
                color: settings[r.key] ? "#fff" : "var(--ssd-text-muted)",
                flexShrink: 0,
              }}
            >
              {settings[r.key] ? "ON" : "OFF"}
            </span>
          </button>
        ))}
      </div>
      {error ? <p style={{ fontSize: 13, color: "var(--ssd-status-support)", margin: "0 0 14px" }}>{error}</p> : null}
      <button style={{ ...primaryBtn, opacity: busy || !loaded ? 0.6 : 1 }} disabled={busy || !loaded} onClick={lockIn}>
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
        The <strong style={{ color: "var(--ssd-ink)" }}>Student records</strong> tab opens any
        student&apos;s complete record — every score, every note from every teacher (shared and
        private), charted over time. When a placing district calls, the answer is one click, not a
        weekend of binders. Every record you open is logged, so your school&apos;s access trail is
        airtight too.
      </p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button style={primaryBtn} onClick={onDone}>Understood — finish launch →</button>
        <a href="/admin/records" style={ghostBtn as React.CSSProperties}>Peek at it now</a>
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
    { label: "Teachers", value: initial.teacherCount, href: "/admin/teachers" },
    { label: "Students tracked", value: initial.studentCount, href: "/admin/usage" },
    { label: "Bell schedule", value: initial.hasSchedule ? "Set" : "Default day", href: "/admin/upload-schedule" },
    { label: "Link types on", value: `${initial.linksOn}/3`, href: "/admin/links" },
  ];

  return (
    <div>
      <style>{`
        @keyframes dwBarGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        .dw-mc-bar { transform-box: fill-box; transform-origin: bottom; animation: dwBarGrow .6s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .dw-mc-bar { animation: none } }
      `}</style>
      <div style={{ ...cardStyle, textAlign: "center", marginBottom: 18 }}>
        <svg width="72" height="72" viewBox="0 0 200 200" aria-hidden="true" style={{ marginBottom: 8 }}>
          <rect className="dw-mc-bar" style={{ animationDelay: ".1s" }} x="38" y="120" width="22" height="40" rx="3" fill="#5DCAA5" />
          <rect className="dw-mc-bar" style={{ animationDelay: ".25s" }} x="68" y="98" width="22" height="62" rx="3" fill="#1D9E75" />
          <rect className="dw-mc-bar" style={{ animationDelay: ".4s" }} x="98" y="74" width="22" height="86" rx="3" fill="#0F6E56" />
          <rect className="dw-mc-bar" style={{ animationDelay: ".55s" }} x="128" y="48" width="22" height="112" rx="3" fill="#1a1a2e" />
          <path d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="158" cy="36" r="8" fill="#EF9F27" />
        </svg>
        <h2 style={{ ...titleStyle, fontSize: 30 }}>{schoolName} is live.</h2>
        <p style={{ ...bodyStyle, maxWidth: 460, margin: "0 auto 6px" }}>
          {isNps
            ? "Your school is set up and yours to run — every tab above, whenever you need it."
            : "Your school is set up — every tab above, whenever you need it."}
        </p>
        <button onClick={onReplay} style={{ ...ghostBtn, fontSize: 12 }}>Replay setup</button>
      </div>

      {/* live tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, maxWidth: 640, margin: "0 auto 18px" }}>
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            style={{
              background: "var(--ssd-surface)",
              border: "1px solid var(--ssd-border)",
              borderTop: "3px solid var(--ssd-green)",
              borderRadius: "var(--ssd-radius)",
              padding: "14px 16px",
              textDecoration: "none",
            }}
          >
            <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 24, color: "var(--ssd-ink)" }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: "var(--ssd-text-muted)" }}>{s.label}</div>
          </a>
        ))}
      </div>

      <div style={{ ...cardStyle, padding: "22px 24px" }}>
        <div style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ssd-text-muted)", marginBottom: 6 }}>
          Send this to your teachers
        </div>
        <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", marginBottom: 12 }}>
          A ready-to-send staff note — then invite them from the Teachers tab and the sign-in
          button lands in their inbox.
        </div>
        <CopyBlock text={teacherBlurb} />
      </div>
    </div>
  );
}

import React from "react";

// The one navy element of the admin experience — a slim branded band that sits
// directly under the tab row on every admin surface (and is the steady-state
// hero on /admin/home). One box, one size, one spot: pages change what it
// says, never where it lives or how big it is, so moving between tabs reads as
// one product instead of the navy hopping (full-bleed stage on one tab, hero
// on another, missing on the rest).
//
// Pure presentational — no hooks, safe in Server Components and client
// components alike. `title`/`sub` render inline on one row (wrapping on small
// screens); `action` is an optional right-aligned control.

const NAVY = "#252a4a";
const NAVY_SOFT = "#2a2b48";
const TEAL = "#1D9E75";
const TEAL_LIGHT = "#5DCAA5";
const AMBER = "#EF9F27";

export default function AdminNavyBand({
  title,
  sub,
  action,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 18,
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_SOFT} 100%)`,
        padding: "16px 22px",
        overflow: "hidden",
        marginBottom: 18,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <style>{`
        @keyframes dwBandBar { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        .dw-band-bar { transform-box: fill-box; transform-origin: bottom; animation: dwBandBar .6s cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .dw-band-bar { animation: none } }
      `}</style>
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -20,
          top: -50,
          width: 180,
          height: 180,
          opacity: 0.1,
          pointerEvents: "none",
        }}
      >
        <path d="M38 150 C 78 124, 128 100, 158 36" stroke={AMBER} strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="158" cy="36" r="7" fill={AMBER} />
      </svg>
      <svg width={40} height={40} viewBox="0 0 200 200" aria-hidden="true" style={{ flexShrink: 0 }}>
        {[
          { x: 38, y: 120, h: 40, fill: "rgba(225,245,238,.9)" },
          { x: 68, y: 98, h: 62, fill: TEAL_LIGHT },
          { x: 98, y: 74, h: 86, fill: TEAL },
          { x: 128, y: 48, h: 112, fill: "#0c5a46" },
        ].map((b, i) => (
          <rect
            key={i}
            className="dw-band-bar"
            style={{ animationDelay: `${0.1 + i * 0.15}s` }}
            x={b.x}
            y={b.y}
            width="22"
            height={b.h}
            rx="3"
            fill={b.fill}
          />
        ))}
        <path d="M38 150 C 78 124, 128 100, 158 36" stroke={AMBER} strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="158" cy="36" r="8" fill={AMBER} />
      </svg>
      <div style={{ flex: 1, minWidth: 220 }}>
        <span
          style={{
            fontFamily: "var(--ssd-font-display), Georgia, serif",
            fontSize: 20,
            fontWeight: 500,
            color: "#fff",
          }}
        >
          {title}
        </span>
        {sub ? (
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.65)", marginLeft: 10 }}>{sub}</span>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}

// Unified opening splash — the Sure Step Education "front door" (aesthetic MD §5).
// Navy field, the ascending-bars logo drawing itself, the wordmark fading up.
// Used as the SINGLE loading screen everywhere (landing auth-check, dashboard
// shell, dashboard data load) so route transitions read as one smooth moment
// instead of three different cards flashing different colors/text.
//
// Fonts come from the global --ssd-font-* CSS vars (set by next/font in
// layout.tsx), so DM Serif Display / DM Mono render on every page.
export default function Splash({ label = "DailyWins", fading = false }: { label?: string; fading?: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--ssd-navy, #252a4a)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Dissolve out (MD §5): fade + slight scale-up over 0.6s.
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.05)" : "scale(1)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes ssBarGrow { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        @keyframes ssDraw { to { stroke-dashoffset: 0 } }
        @keyframes ssFadeUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @keyframes ssPulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }
        .ss-bar { transform-box: fill-box; transform-origin: bottom; animation: ssBarGrow 0.6s cubic-bezier(.22,1,.36,1) both; }
        .ss-curve { stroke-dasharray: 210; stroke-dashoffset: 210; animation: ssDraw 0.85s ease 0.55s forwards; }
        .ss-dot { opacity: 0; animation: ssFadeUp 0.4s ease 1s forwards, ssPulse 2.6s ease 1.6s infinite; }
        .ss-word { animation: ssFadeUp 0.7s ease 0.55s both; }
        @media (prefers-reduced-motion: reduce) {
          .ss-bar, .ss-curve, .ss-dot, .ss-word {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      <svg width="96" height="96" viewBox="0 0 200 200" aria-hidden="true">
        <rect className="ss-bar" style={{ animationDelay: "0.15s" }} x="38" y="120" width="22" height="40" rx="3" fill="#E1F5EE" />
        <rect className="ss-bar" style={{ animationDelay: "0.30s" }} x="68" y="98" width="22" height="62" rx="3" fill="#5DCAA5" />
        <rect className="ss-bar" style={{ animationDelay: "0.45s" }} x="98" y="74" width="22" height="86" rx="3" fill="#1D9E75" />
        <rect className="ss-bar" style={{ animationDelay: "0.60s" }} x="128" y="48" width="22" height="112" rx="3" fill="#0F6E56" />
        <path className="ss-curve" d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle className="ss-dot" cx="158" cy="36" r="6" fill="#EF9F27" />
      </svg>

      <div className="ss-word" style={{ textAlign: "center", marginTop: 24 }}>
        <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 32, lineHeight: 1.05, color: "#ffffff" }}>Sure Step</div>
        <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 21, color: "#5DCAA5" }}>Education</div>
        <div style={{ fontFamily: "var(--ssd-font-mono), ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginTop: 12 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// The universal loading state — used for EVERY wait (landing auth-check,
// dashboard shell + data load, route transitions). The big Splash is the
// once-per-session front door; this is the same calm cream screen everywhere
// else, so loads never jump between a big takeover and a tiny spinner. The mark
// breathes, a slim teal shimmer says "working." See splash-concepts/3-quiet-confident.html.
export default function QuietLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--ssd-paper, #F7F5F0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <style>{`
        @keyframes ssBreathe { 0%, 100% { opacity: .92; transform: scale(1) } 50% { opacity: .6; transform: scale(.97) } }
        @keyframes ssSettle { 0%, 100% { transform: scaleY(1) } 50% { transform: scaleY(.9) } }
        @keyframes ssShimmer { to { left: 130% } }
        .ss-quiet-mark { animation: ssBreathe 2.2s ease-in-out infinite; }
        .ss-qbar { transform-box: fill-box; transform-origin: bottom; animation: ssSettle 2.2s ease-in-out infinite; }
        .ss-qbar.b2 { animation-delay: .12s } .ss-qbar.b3 { animation-delay: .24s } .ss-qbar.b4 { animation-delay: .36s }
        .ss-track { width: 148px; height: 3px; border-radius: 3px; background: #e8e4d8; overflow: hidden; position: relative; }
        .ss-track::after { content: ""; position: absolute; left: -40%; top: 0; height: 100%; width: 40%; border-radius: 3px;
          background: linear-gradient(90deg, transparent, #1D9E75, transparent); animation: ssShimmer 1.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ss-quiet-mark, .ss-qbar { animation: none !important; }
          .ss-track::after { animation: none !important; left: 30% !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <svg className="ss-quiet-mark" width="92" height="74" viewBox="0 0 120 96" aria-hidden="true">
          <rect className="ss-qbar b1" x="2" y="52" width="22" height="42" rx="4" fill="#5DCAA5" />
          <rect className="ss-qbar b2" x="32" y="36" width="22" height="58" rx="4" fill="#1D9E75" />
          <rect className="ss-qbar b3" x="62" y="22" width="22" height="72" rx="4" fill="#0F6E56" />
          <rect className="ss-qbar b4" x="92" y="6" width="22" height="88" rx="4" fill="var(--ssd-navy, #252a4a)" />
        </svg>
        <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 30, letterSpacing: "-0.3px", color: "var(--ssd-ink, #1a1a2e)" }}>
          Daily<span style={{ color: "#1D9E75" }}>Wins</span>
        </div>
        <div className="ss-track" />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 28,
          fontFamily: "var(--ssd-font-mono), ui-monospace, monospace",
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--ssd-text-muted, #7a7a8e)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

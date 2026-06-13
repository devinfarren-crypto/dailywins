// The opening splash — DailyWins' once-per-session "front door" (SplashGate).
// Warm cream stage: the ascending bars spring up with a bounce, the amber
// growth-curve sweeps to its dot, the "DailyWins" wordmark pops in, and a small
// confetti burst celebrates. Playful on purpose — the product is kids earning
// wins, not a consulting deck. See splash-concepts/1-playful-brand.html.
//
// Fonts come from the global --ssd-font-* CSS vars (set by next/font in
// layout.tsx). `fading` drives the dissolve handled by SplashGate.
const CONFETTI = [
  { tx: "-120px", ty: "-90px", color: "#EF9F27" },
  { tx: "120px", ty: "-80px", color: "#1D9E75" },
  { tx: "-90px", ty: "60px", color: "#0F6E56" },
  { tx: "140px", ty: "40px", color: "#5DCAA5" },
  { tx: "0px", ty: "-130px", color: "#EF9F27" },
];

export default function Splash({ fading = false }: { label?: string; fading?: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(120% 120% at 50% 18%, #fffdf8 0%, var(--ssd-paper, #F7F5F0) 46%, var(--ssd-surface-alt, #EFEBE0) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        // Dissolve out: fade + slight scale-up over 0.6s (driven by SplashGate).
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.04)" : "scale(1)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes ssGrow { 0% { transform: scaleY(0) } 70% { transform: scaleY(1.08) } 100% { transform: scaleY(1) } }
        @keyframes ssDraw { to { stroke-dashoffset: 0 } }
        @keyframes ssPop { 0% { opacity: 0; transform: scale(0) } 60% { opacity: 1; transform: scale(1.3) } 100% { opacity: 1; transform: scale(1) } }
        @keyframes ssRise { to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes ssFly { 0% { opacity: 1; transform: translate(0,0) rotate(0) } 100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(220deg) } }

        .ss-bar { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); animation: ssGrow 0.9s cubic-bezier(.2,1.25,.4,1) forwards; }
        .ss-curve { stroke-dasharray: 340; stroke-dashoffset: 340; animation: ssDraw 0.8s ease-out 0.62s forwards; }
        .ss-dot { opacity: 0; transform: scale(0); transform-box: fill-box; transform-origin: center; animation: ssPop 0.5s cubic-bezier(.2,1.4,.4,1) 1.05s forwards; }
        .ss-word { opacity: 0; transform: translateY(14px) scale(.9); animation: ssRise 0.7s cubic-bezier(.2,1.3,.35,1) 0.95s forwards; }
        .ss-confetti i { position: absolute; left: 50%; top: 40%; width: 9px; height: 9px; border-radius: 2px; opacity: 0; animation: ssFly 0.9s ease-out 1.05s forwards; }

        @media (prefers-reduced-motion: reduce) {
          .ss-bar { transform: scaleY(1) !important; animation: none !important; }
          .ss-curve { stroke-dashoffset: 0 !important; animation: none !important; }
          .ss-dot, .ss-word { opacity: 1 !important; transform: none !important; animation: none !important; }
          .ss-confetti i { display: none !important; }
        }
      `}</style>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width="220" height="176" viewBox="0 0 230 184" aria-hidden="true">
          <rect className="ss-bar" style={{ animationDelay: "0.10s" }} x="6" y="100" width="40" height="78" rx="6" fill="#5DCAA5" />
          <rect className="ss-bar" style={{ animationDelay: "0.24s" }} x="58" y="68" width="40" height="110" rx="6" fill="#1D9E75" />
          <rect className="ss-bar" style={{ animationDelay: "0.38s" }} x="110" y="40" width="40" height="138" rx="6" fill="#0F6E56" />
          <rect className="ss-bar" style={{ animationDelay: "0.52s" }} x="162" y="14" width="40" height="164" rx="6" fill="var(--ssd-navy, #252a4a)" />
          <path className="ss-curve" d="M14 150 C70 140, 110 86, 182 24" fill="none" stroke="#EF9F27" strokeWidth="7" strokeLinecap="round" />
          <circle className="ss-dot" cx="182" cy="24" r="9" fill="#EF9F27" />
        </svg>

        <div className="ss-word" style={{ textAlign: "center", marginTop: 26 }}>
          <div style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 50, lineHeight: 1, letterSpacing: "-0.5px", color: "var(--ssd-ink, #1a1a2e)" }}>
            Daily<span style={{ color: "#EF9F27" }}>Wins</span>
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--ssd-font-body), system-ui, sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1D9E75" }}>
            Every period, a win
          </div>
        </div>

        <div className="ss-confetti" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <i key={i} style={{ "--tx": c.tx, "--ty": c.ty, background: c.color } as React.CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  );
}

// The calm in-app loading state. The full navy Splash is the once-per-session
// front door (SplashGate); every OTHER wait — landing auth-check, dashboard
// chunk load, dashboard data load — uses this instead: cream surface, the logo
// mark gently pulsing, no ceremony. Swapping a navy takeover for this is what
// keeps the splash from feeling like it "happens constantly."
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
        gap: 14,
      }}
    >
      <style>{`
        @keyframes ssQuietPulse { 0%, 100% { opacity: 0.85 } 50% { opacity: 0.45 } }
        .ss-quiet-mark { animation: ssQuietPulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ss-quiet-mark { animation: none; } }
      `}</style>
      <svg className="ss-quiet-mark" width="44" height="44" viewBox="0 0 200 200" aria-hidden="true">
        <rect x="38" y="120" width="22" height="40" rx="3" fill="#5DCAA5" />
        <rect x="68" y="98" width="22" height="62" rx="3" fill="#1D9E75" />
        <rect x="98" y="74" width="22" height="86" rx="3" fill="#0F6E56" />
        <rect x="128" y="48" width="22" height="112" rx="3" fill="#1a1a2e" />
        <path d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" strokeWidth="6" strokeLinecap="round" fill="none" />
        <circle cx="158" cy="36" r="8" fill="#EF9F27" />
      </svg>
      <div
        style={{
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

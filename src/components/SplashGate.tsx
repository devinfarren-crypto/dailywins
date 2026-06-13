"use client";

// Holds the opening Splash for a fixed minimum so it can't "flash" when the
// underlying page loads quickly. Shows for 2.5s, dissolves over 0.6s, then
// unmounts.
//
// Frequency: ONCE PER BROWSER SESSION (sessionStorage flag), not once per
// page load — refreshes and admin-page hard loads within the same tab skip
// straight to the app. A new tab or a browser restart shows it again. The
// check runs in a layout effect (before paint), so the skip never flashes
// a frame of navy, and the server-rendered HTML still matches on hydration.

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Splash from "./Splash";

const HOLD_MS = 2500;
const DISSOLVE_MS = 600;
const SEEN_KEY = "ssd-splash-seen";

// useLayoutEffect warns when server-rendering a client component; swap in
// useEffect on the server where it never runs anyway.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function SplashGate({ children }: { children: React.ReactNode }) {
  // The Locker has its own entry ritual (the door swings open) and the public
  // /demo sandbox must be instant for cold-email prospects — the splash never
  // shows on either. We read the path with usePathname (NOT window.location in
  // an effect) so the suppression happens during SSR: otherwise the splash is
  // server-rendered into the HTML and its CSS animation plays for a frame on
  // /locker before hydration can yank it — the "partial splash that doesn't
  // complete" bug. Computing it here means the splash never enters the markup.
  const pathname = usePathname();
  const suppressed = !!pathname && (pathname.startsWith("/locker") || pathname.startsWith("/demo"));

  // Seeding the initial phase from `suppressed` keeps SSR and the first client
  // render in agreement (no hydration mismatch) and means non-suppressed routes
  // still paint the splash immediately on first frame.
  const [phase, setPhase] = useState<"show" | "fading" | "done">(suppressed ? "done" : "show");

  useIsoLayoutEffect(() => {
    if (suppressed) {
      setPhase("done");
      return;
    }
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      if (!seen) sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // sessionStorage unavailable (privacy mode) — fall back to showing once.
    }
    if (seen) {
      setPhase("done");
      return;
    }
    const t1 = setTimeout(() => setPhase("fading"), HOLD_MS);
    const t2 = setTimeout(() => setPhase("done"), HOLD_MS + DISSOLVE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [suppressed]);

  return (
    <>
      {children}
      {phase !== "done" && <Splash fading={phase === "fading"} />}
    </>
  );
}

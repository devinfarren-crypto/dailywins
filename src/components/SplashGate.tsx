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
import Splash from "./Splash";

const HOLD_MS = 2500;
const DISSOLVE_MS = 600;
const SEEN_KEY = "ssd-splash-seen";

// useLayoutEffect warns when server-rendering a client component; swap in
// useEffect on the server where it never runs anyway.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");

  useIsoLayoutEffect(() => {
    // The Locker has its own entry ritual (the door swings open) and the
    // public /demo sandbox must be instant for cold-email prospects — the
    // Sure Step splash never shows on either.
    if (
      typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/locker") || window.location.pathname.startsWith("/demo"))
    ) {
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
  }, []);

  return (
    <>
      {children}
      {phase !== "done" && <Splash fading={phase === "fading"} />}
    </>
  );
}

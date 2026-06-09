"use client";

// Holds the opening Splash for a fixed minimum so it can't "flash" when the
// underlying page loads quickly. Shows for 2.5s, dissolves over 0.6s, then
// unmounts. Lives once at the layout level, so it plays on a full page load /
// refresh (the "front door") but NOT on in-app client navigations — the layout
// stays mounted, so this effect runs only once per hard load.

import { useEffect, useState } from "react";
import Splash from "./Splash";

const HOLD_MS = 2500;
const DISSOLVE_MS = 600;

export default function SplashGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"show" | "fading" | "done">("show");

  useEffect(() => {
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

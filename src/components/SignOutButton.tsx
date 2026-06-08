"use client";

// Reusable sign-out control for the admin surfaces (site_admin / district_admin /
// founder). The admin pages are Server Components, so the actual signOut() has to
// run client-side — this mirrors the teacher dashboard's handleSignOut: clear the
// Supabase session, then hard-navigate to the landing page so every Server
// Component re-evaluates auth from a clean slate.

import { useState } from "react";
import { createClient } from "@/src/lib/supabase";

export default function SignOutButton() {
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      // Full reload (not router.push) guarantees server-rendered admin pages
      // drop their cached session and the landing page renders signed-out.
      window.location.assign("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      aria-label="Sign out"
      style={{
        fontSize: 13,
        fontWeight: 600,
        padding: "7px 14px",
        borderRadius: 8,
        border: "1px solid var(--ssd-border, #e4e7e3)",
        background: "var(--ssd-surface, #ffffff)",
        color: "var(--ssd-text-muted, #5a6e66)",
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

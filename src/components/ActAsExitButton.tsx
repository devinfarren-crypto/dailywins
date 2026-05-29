"use client";

import { useState } from "react";

export default function ActAsExitButton() {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/act-as/end", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to exit act-as session");
      }
      // Hard reload so every RLS-bound query re-runs as the actor.
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Unable to exit");
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="rounded-md bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-white/25 disabled:opacity-60"
    >
      {busy ? "Exiting…" : "Exit act-as"}
    </button>
  );
}

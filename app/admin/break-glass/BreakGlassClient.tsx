"use client";

import { useState } from "react";

export interface CandidateRow {
  auth_id: string;
  full_name: string;
  email: string;
  detail: string;
  is_admin: boolean;
}

export default function BreakGlassClient({
  candidates,
}: {
  candidates: CandidateRow[];
}) {
  const [target, setTarget] = useState<CandidateRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const openModal = (c: CandidateRow) => {
    setTarget(c);
    setReason("");
    setError("");
  };

  const closeModal = () => {
    if (busy) return;
    setTarget(null);
    setReason("");
    setError("");
  };

  const startBreakGlass = async () => {
    if (!target) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A reason is required.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/break-glass/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ target_user_id: target.auth_id, reason: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to start break-glass session");
      }
      // Hard reload so every RLS-bound query re-resolves as the target.
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Break-glass failed");
      setBusy(false);
    }
  };

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? candidates.filter(
        (c) =>
          c.full_name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle) ||
          c.detail.toLowerCase().includes(needle)
      )
    : candidates;

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-rose-700">
            Break-glass access
          </h1>
          <p className="mt-1 text-sm text-[#8a9690]">
            Emergency impersonation of <span className="font-semibold">any</span>{" "}
            account, including other admins. Every session requires a written
            reason, is capped at a hard 15-minute timeout, and is recorded in the
            audit log. Use regular{" "}
            <a href="/admin/teachers" className="underline text-[#3a7c6a]">
              act-as
            </a>{" "}
            for routine teacher support.
          </p>
        </header>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, email, or role…"
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#2a4d42] outline-none focus:border-rose-400"
        />

        {candidates.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-[#8a9690]">
            No other accounts to target.
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((c) => (
              <li
                key={c.auth_id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2a4d42]">
                      {c.full_name}
                    </span>
                    {c.is_admin ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                        Admin
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-gray-700">
                    {c.email || "(no email)"}
                  </div>
                  <div className="mt-1 text-xs text-[#8a9690]">{c.detail}</div>
                </div>
                <button
                  onClick={() => openModal(c)}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
                >
                  Break-glass
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {target ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-rose-700">
              Break-glass into {target.full_name}?
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              You are about to impersonate{" "}
              <span className="font-semibold">{target.email || target.full_name}</span>
              . This is logged with your name and the reason below, and ends
              automatically after <span className="font-semibold">15 minutes</span>.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#8a9690]">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. Investigating a score-save bug reported by this teacher"
              className="mt-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#2a4d42] outline-none focus:border-rose-400"
            />

            {error ? (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={closeModal}
                disabled={busy}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={startBreakGlass}
                disabled={busy || !reason.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Starting…" : "Start break-glass"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

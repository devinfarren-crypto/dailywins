"use client";

import { useState } from "react";

export default function PendingClient({
  initialStatus,
  initialSchoolName,
}: {
  initialStatus: string;
  initialSchoolName: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    const trimmed = schoolName.trim();
    if (!trimmed) {
      setError("Please enter your school name.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/access-request/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ school_name: trimmed }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to save your school name.");
      }

      setSaved(true);
      setStatus("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your school name.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f0] flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-xl rounded-2xl bg-white shadow-sm border border-gray-200 p-8 md:p-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3a7c6a] text-white text-2xl font-bold">
          DW
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42] mb-3">You&apos;re on the list 🎉</h1>
        <p className="text-gray-700 leading-relaxed mb-6">
          Your beta access request is currently pending. We&apos;re onboarding testers one at a time,
          so this usually takes a day or two while we review your school details.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-[#faf7f0] p-5">
          <label className="block text-sm font-semibold text-[#2a4d42]" htmlFor="school-name">
            Your school
          </label>
          <input
            id="school-name"
            type="text"
            value={schoolName}
            onChange={(event) => setSchoolName(event.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20"
            placeholder="Enter your school name"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-[#3a7c6a] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4d42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send my info"}
          </button>
        </form>

        <p className="mt-4 text-sm text-[#8a9690]">
          Current status: <span className="font-semibold capitalize text-[#2a4d42]">{status}</span>
        </p>

        {saved ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Thanks — your school information has been saved and we&apos;ll review it with your request.
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}
      </section>
    </main>
  );
}

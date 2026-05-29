"use client";

import { useState } from "react";

export interface TeacherRow {
  id: string;
  auth_id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  district: string | null;
}

export default function TeachersClient({
  teachers,
  isFounder,
}: {
  teachers: TeacherRow[];
  isFounder: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const startActAs = async (teacher: TeacherRow) => {
    setError("");
    setBusyId(teacher.auth_id);
    try {
      const res = await fetch("/api/admin/act-as/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ target_user_id: teacher.auth_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Unable to start act-as session");
      }
      // Hard reload so every RLS-bound query re-resolves as the target.
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Act-as failed");
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42]">
            Teachers
          </h1>
          <p className="mt-1 text-sm text-[#8a9690]">
            {isFounder
              ? "All teachers across the platform."
              : "Teachers in your scope."}
            {" "}
            Click <span className="font-semibold">Act as</span> to view the app
            from a teacher&rsquo;s perspective under audit.
          </p>
        </header>

        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {teachers.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-[#8a9690]">
            No teachers in scope yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {teachers.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#2a4d42]">
                    {t.full_name}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-gray-700">
                    {t.email}
                  </div>
                  <div className="mt-1 text-xs text-[#8a9690]">
                    {t.school_name ?? "(no school)"}
                    {t.district ? ` · ${t.district}` : null}
                  </div>
                </div>
                <button
                  onClick={() => startActAs(t)}
                  disabled={busyId === t.auth_id}
                  className="rounded-xl bg-[#3a7c6a] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4d42] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === t.auth_id ? "Starting…" : "Act as"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

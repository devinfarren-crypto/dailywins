"use client";

import { useState } from "react";

export interface TeacherRow {
  id: string;
  auth_id: string;
  full_name: string;
  email: string;
  school_name: string | null;
  district: string | null;
  deactivated: boolean;
}

export default function TeachersClient({
  teachers: initialTeachers,
  isFounder,
  isSiteAdmin,
}: {
  teachers: TeacherRow[];
  isFounder: boolean;
  isSiteAdmin: boolean;
}) {
  const [teachers, setTeachers] = useState<TeacherRow[]>(initialTeachers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Invite flow
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const canManage = isFounder || isSiteAdmin; // deactivate / reactivate

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
      if (!res.ok) throw new Error(body.error ?? "Unable to start act-as session");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Act-as failed");
      setBusyId(null);
    }
  };

  const generateInvite = async () => {
    setError("");
    setInviting(true);
    setInviteUrl("");
    setCopied(false);
    try {
      const res = await fetch("/api/admin/invite-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Unable to create invite");
      setInviteUrl(body.invite_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select and copy the link manually.");
    }
  };

  const toggleActive = async (teacher: TeacherRow) => {
    setError("");
    setBusyId(teacher.id);
    const nextActive = teacher.deactivated; // reactivate if currently deactivated
    try {
      const res = await fetch("/api/admin/teacher-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ teacher_id: teacher.id, active: nextActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Unable to update teacher");
      setTeachers((prev) =>
        prev.map((t) => (t.id === teacher.id ? { ...t, deactivated: !nextActive } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42]">Teachers</h1>
            <p className="mt-1 text-sm text-[#8a9690]">
              {isFounder ? "All teachers across the platform." : "Teachers at your school."}
              {isFounder
                ? " Click Act as to view the app from a teacher’s perspective under audit."
                : null}
            </p>
          </div>
          {isSiteAdmin ? (
            <button
              onClick={generateInvite}
              disabled={inviting}
              className="rounded-xl bg-[#1c5c3c] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#16263d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviting ? "Generating…" : "+ Invite teacher"}
            </button>
          ) : null}
        </header>

        {inviteUrl ? (
          <div className="mb-4 rounded-2xl border border-[#e4e7e3] bg-white p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold text-[#16263d]">
              Invite link — share it with the teacher (single use):
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700"
              />
              <button
                onClick={copyInvite}
                className="rounded-lg bg-[#16263d] px-3 py-2 text-xs font-semibold text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

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
                className={`flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${
                  t.deactivated ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2a4d42]">{t.full_name}</span>
                    {t.deactivated ? (
                      <span className="rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        Deactivated
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-gray-700">{t.email}</div>
                  <div className="mt-1 text-xs text-[#8a9690]">
                    {t.school_name ?? "(no school)"}
                    {t.district ? ` · ${t.district}` : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isFounder && !t.deactivated ? (
                    <button
                      onClick={() => startActAs(t)}
                      disabled={busyId === t.auth_id}
                      className="rounded-xl bg-[#3a7c6a] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4d42] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === t.auth_id ? "Starting…" : "Act as"}
                    </button>
                  ) : null}
                  {canManage ? (
                    <button
                      onClick={() => toggleActive(t)}
                      disabled={busyId === t.id}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        t.deactivated
                          ? "border-[#1c5c3c] text-[#1c5c3c] hover:bg-[#1c5c3c]/5"
                          : "border-rose-300 text-rose-700 hover:bg-rose-50"
                      }`}
                    >
                      {busyId === t.id
                        ? "Saving…"
                        : t.deactivated
                          ? "Reactivate"
                          : "Deactivate"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

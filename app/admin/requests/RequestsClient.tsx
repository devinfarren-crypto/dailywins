"use client";

import { useEffect, useMemo, useState } from "react";

type AccessRequest = {
  id: string;
  email: string;
  full_name: string;
  school_name: string | null;
  status: "pending" | "approved" | "denied" | string;
  created_at: string;
  reviewed_at: string | null;
};

type SchoolOption = {
  id: string;
  name: string;
  district: string;
};

type DistrictOption = {
  id: string;
  name: string;
};

type GrantRole = "teacher" | "site_admin" | "district_admin" | "nps_director";

type ApprovePayload = {
  role: GrantRole;
  existing_school_id?: string;
  new_school?: { name: string; district: string };
  district_id?: string;
  new_nps?: { name: string };
};

const ROLE_OPTIONS: { value: GrantRole; label: string; hint: string }[] = [
  { value: "teacher", label: "Teacher", hint: "Tracks behavior in the dashboard. Scoped to one school." },
  { value: "site_admin", label: "Site Admin", hint: "Manages teachers & schedules at one school. Can act-as its teachers." },
  { value: "district_admin", label: "District Admin", hint: "Oversees every school in a district. Can act-as its teachers." },
  { value: "nps_director", label: "NPS Director", hint: "Stands up a whole non-public school in one step: creates the organization + its school and grants this person full director oversight." },
];

type Filter = "pending" | "all";

const NEW_SCHOOL = "__new__";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function RequestsClient({
  initialRequests,
}: {
  initialRequests: AccessRequest[];
}) {
  const [requests, setRequests] = useState<AccessRequest[]>(initialRequests);
  const [filter, setFilter] = useState<Filter>("pending");
  const [approving, setApproving] = useState<AccessRequest | null>(null);
  const [denying, setDenying] = useState<AccessRequest | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [flash, setFlash] = useState<string>("");

  const visible = useMemo(() => {
    if (filter === "pending") {
      return requests.filter((r) => r.status === "pending");
    }
    return requests;
  }, [requests, filter]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );

  const handleApproved = (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              reviewed_at: new Date().toISOString(),
            }
          : r
      )
    );
  };

  const handleDenied = (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "denied",
              reviewed_at: new Date().toISOString(),
            }
          : r
      )
    );
  };

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42]">
              Beta access requests
            </h1>
            <p className="mt-1 text-sm text-[#8a9690]">
              {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            </p>
          </div>
          <div className="flex gap-2 rounded-xl border border-gray-200 bg-white p-1">
            <button
              onClick={() => setFilter("pending")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filter === "pending"
                  ? "bg-[#3a7c6a] text-white"
                  : "text-[#2a4d42] hover:bg-gray-100"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                filter === "all"
                  ? "bg-[#3a7c6a] text-white"
                  : "text-[#2a4d42] hover:bg-gray-100"
              }`}
            >
              All
            </button>
          </div>
        </header>

        {flash ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {flash}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-[#8a9690]">
            {filter === "pending"
              ? "No pending requests right now."
              : "No access requests yet."}
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((req) => (
              <li
                key={req.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#2a4d42]">
                        {req.full_name}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <div className="mt-0.5 truncate text-sm text-gray-700">
                      {req.email}
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      <span className="text-[#8a9690]">School hint:</span>{" "}
                      {req.school_name ? (
                        <span>{req.school_name}</span>
                      ) : (
                        <span className="italic text-[#8a9690]">
                          (not provided)
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-[#8a9690]">
                      Requested {formatDate(req.created_at)}
                      {req.reviewed_at
                        ? ` · reviewed ${formatDate(req.reviewed_at)}`
                        : null}
                    </div>
                  </div>
                  {req.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setError("");
                          setApproving(req);
                        }}
                        disabled={busyId === req.id}
                        className="rounded-xl bg-[#3a7c6a] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4d42] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setError("");
                          setDenying(req);
                        }}
                        disabled={busyId === req.id}
                        className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Deny
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {approving ? (
        <ApproveModal
          request={approving}
          busy={busyId === approving.id}
          onClose={() => setApproving(null)}
          onError={setError}
          onSubmit={async (payload) => {
            setError("");
            setBusyId(approving.id);
            try {
              const res = await fetch("/api/admin/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                  request_id: approving.id,
                  ...payload,
                }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(body.error ?? "Unable to approve request");
              }
              handleApproved(approving.id);
              setFlash(`Approved ${approving.email}.`);
              setApproving(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Approve failed");
            } finally {
              setBusyId(null);
            }
          }}
        />
      ) : null}

      {denying ? (
        <DenyModal
          request={denying}
          busy={busyId === denying.id}
          onClose={() => setDenying(null)}
          onConfirm={async () => {
            setError("");
            setBusyId(denying.id);
            try {
              const res = await fetch("/api/admin/deny", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ request_id: denying.id }),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) {
                throw new Error(body.error ?? "Unable to deny request");
              }
              handleDenied(denying.id);
              setFlash(`Denied ${denying.email}.`);
              setDenying(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Deny failed");
            } finally {
              setBusyId(null);
            }
          }}
        />
      ) : null}
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "denied"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

function ApproveModal({
  request,
  busy,
  onClose,
  onError,
  onSubmit,
}: {
  request: AccessRequest;
  busy: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSubmit: (payload: ApprovePayload) => Promise<void>;
}) {
  const [role, setRole] = useState<GrantRole>("teacher");
  const [schools, setSchools] = useState<SchoolOption[] | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [selection, setSelection] = useState<string>("");
  const [newName, setNewName] = useState(request.school_name ?? "");
  const [newDistrict, setNewDistrict] = useState("");
  const [districts, setDistricts] = useState<DistrictOption[] | null>(null);
  const [districtSelection, setDistrictSelection] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [schoolRes, districtRes] = await Promise.all([
          fetch("/api/admin/schools", { credentials: "same-origin", cache: "no-store" }),
          fetch("/api/admin/districts", { credentials: "same-origin", cache: "no-store" }),
        ]);
        const schoolBody = await schoolRes.json().catch(() => ({}));
        if (!schoolRes.ok) {
          throw new Error(schoolBody.error ?? "Unable to load schools");
        }
        const districtBody = await districtRes.json().catch(() => ({}));
        if (cancelled) return;
        const schoolList = (schoolBody.schools ?? []) as SchoolOption[];
        setSchools(schoolList);
        setSelection(schoolList.length > 0 ? schoolList[0].id : NEW_SCHOOL);
        const districtList = (districtBody.districts ?? []) as DistrictOption[];
        setDistricts(districtList);
        setDistrictSelection(districtList.length > 0 ? districtList[0].id : "");
      } catch (err) {
        if (cancelled) return;
        onError(err instanceof Error ? err.message : "Unable to load schools");
        setSchools([]);
        setSelection(NEW_SCHOOL);
        setDistricts([]);
      } finally {
        if (!cancelled) setLoadingSchools(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const isNew = selection === NEW_SCHOOL;
  const isDistrictAdmin = role === "district_admin";
  const isNpsDirector = role === "nps_director";
  const canSubmit = isNpsDirector
    ? newName.trim().length >= 2
    : isDistrictAdmin
      ? districtSelection.length > 0
      : isNew
        ? newName.trim().length > 0 && newDistrict.trim().length > 0
        : selection.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    if (isNpsDirector) {
      await onSubmit({ role, new_nps: { name: newName.trim() } });
    } else if (isDistrictAdmin) {
      await onSubmit({ role, district_id: districtSelection });
    } else if (isNew) {
      await onSubmit({
        role,
        new_school: { name: newName.trim(), district: newDistrict.trim() },
      });
    } else {
      await onSubmit({ role, existing_school_id: selection });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-[#2a4d42]">Approve request</h2>
        <p className="mt-1 text-sm text-gray-700">
          Map <span className="font-semibold">{request.email}</span> to a school.
        </p>
        {request.school_name ? (
          <p className="mt-2 rounded-xl bg-[#faf7f0] px-3 py-2 text-xs text-[#8a9690]">
            They typed:{" "}
            <span className="font-semibold text-[#2a4d42]">
              {request.school_name}
            </span>
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          <label className="block text-sm font-semibold text-[#2a4d42]">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as GrantRole)}
            disabled={busy}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20 disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#8a9690]">
            {ROLE_OPTIONS.find((r) => r.value === role)?.hint}
          </p>

          {isNpsDirector ? (
            <>
              <label className="block text-sm font-semibold text-[#2a4d42]">
                Organization / school name
              </label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={busy}
                required
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20 disabled:opacity-60"
                placeholder="Bright Path Academy"
              />
              <p className="text-xs text-[#8a9690]">
                One step: creates the NPS organization and its school, and makes this
                person its director (full oversight — teachers, schedules, links,
                usage, audit, notes archive).
              </p>
            </>
          ) : isDistrictAdmin ? (
            <>
              <label className="block text-sm font-semibold text-[#2a4d42]">
                District
              </label>
              <select
                value={districtSelection}
                onChange={(e) => setDistrictSelection(e.target.value)}
                disabled={loadingSchools || busy}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20 disabled:opacity-60"
              >
                {loadingSchools ? <option>Loading districts…</option> : null}
                {districts?.length === 0 && !loadingSchools ? (
                  <option value="">No districts found</option>
                ) : null}
                {districts?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="block text-sm font-semibold text-[#2a4d42]">
                School
              </label>
              <select
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                disabled={loadingSchools || busy}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20 disabled:opacity-60"
              >
                {loadingSchools ? <option>Loading schools…</option> : null}
                {schools?.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name} — {school.district}
                  </option>
                ))}
                <option value={NEW_SCHOOL}>+ Create a new school…</option>
              </select>

              {isNew ? (
                <div className="space-y-2 rounded-xl border border-gray-200 bg-[#faf7f0] p-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#2a4d42]">
                      School name
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      disabled={busy}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20"
                      placeholder="Pacific Grove High School"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#2a4d42]">
                      District
                    </label>
                    <input
                      value={newDistrict}
                      onChange={(e) => setNewDistrict(e.target.value)}
                      disabled={busy}
                      required
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#3a7c6a] focus:outline-none focus:ring-2 focus:ring-[#3a7c6a]/20"
                      placeholder="Pacific Grove Unified"
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#2a4d42] transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="rounded-xl bg-[#3a7c6a] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2a4d42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Approving…" : "Approve"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DenyModal({
  request,
  busy,
  onClose,
  onConfirm,
}: {
  request: AccessRequest;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-[#2a4d42]">Deny request</h2>
        <p className="mt-2 text-sm text-gray-700">
          Deny access for <span className="font-semibold">{request.email}</span>?
          They will stay signed in but see nothing until you change their status.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#2a4d42] transition hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Denying…" : "Deny"}
          </button>
        </div>
      </div>
    </div>
  );
}

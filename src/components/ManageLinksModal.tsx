"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/src/lib/supabase";

const COLORS = {
  primary: "#3a7c6a",
  dark: "#2a4d42",
  body: "#5a6e66",
  hint: "#8a9690",
  cream: "#faf7f0",
};

interface MagicLink {
  id: string;
  scope_type: string;
  access: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  use_count: number;
}

type Scope = "parent" | "student" | "co_teacher";

// scope_type → public landing route segment.
const SCOPE_PATH: Record<Scope, string> = {
  parent: "parent",
  student: "student",
  co_teacher: "coteacher",
};

const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: "parent", label: "Parent / guardian" },
  { value: "student", label: "Student" },
  { value: "co_teacher", label: "Co-teacher / Paraprofessional" },
];

interface ManageLinksModalProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onClose: () => void;
  // Teacher's school — used to load the school's link policy so disabled
  // types don't appear. The DB enforces regardless (generate_magic_link).
  schoolId?: string | null;
}

export default function ManageLinksModal({ studentId, studentName, open, onClose, schoolId }: ManageLinksModalProps) {
  const [links, setLinks] = useState<MagicLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [scope, setScope] = useState<Scope>("parent");
  const [coteacherWrite, setCoteacherWrite] = useState(false);
  const [studentSelfAssess, setStudentSelfAssess] = useState(false);
  const [linkSettings, setLinkSettings] = useState<Record<string, boolean> | null>(null);

  const supabase = createClient();

  const loadLinks = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase.rpc("list_magic_links", { p_student_id: studentId });
    if (error) {
      setErrorMsg("Could not load links: " + error.message);
      setLoading(false);
      return;
    }
    setLinks((data as MagicLink[]) ?? []);
    setLoading(false);
  }, [studentId, supabase]);

  useEffect(() => {
    if (open && studentId) {
      loadLinks();
      setNewUrl("");
      setCopied(false);
    }
  }, [open, studentId, loadLinks]);

  // School link policy (director-controlled). Default everything on if the
  // lookup fails — the RPC still enforces the real policy on generate.
  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_school_link_settings", { p_school_id: schoolId });
      if (cancelled) return;
      setLinkSettings({
        parent: data?.parent !== false,
        student: data?.student !== false,
        co_teacher: data?.co_teacher !== false,
      });
    })();
    return () => { cancelled = true; };
  }, [open, schoolId, supabase]);

  const allowedScopes = SCOPE_OPTIONS.filter((o) => linkSettings?.[o.value] !== false);

  // Keep the selected scope legal if the policy hides the current one.
  useEffect(() => {
    if (allowedScopes.length > 0 && !allowedScopes.some((o) => o.value === scope)) {
      setScope(allowedScopes[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkSettings]);

  const handleGenerate = async () => {
    setGenerating(true);
    setErrorMsg("");
    setNewUrl("");
    const access =
      (scope === "co_teacher" && coteacherWrite) || (scope === "student" && studentSelfAssess)
        ? "readwrite"
        : "read";
    const { data, error } = await supabase.rpc("generate_magic_link", {
      p_scope_type: scope,
      p_student_id: studentId,
      p_access: access,
    });
    if (error) {
      setErrorMsg("Could not generate link: " + error.message);
      setGenerating(false);
      return;
    }
    const token = data as string;
    setNewUrl(`${window.location.origin}/${SCOPE_PATH[scope]}/${token}`);
    setGenerating(false);
    loadLinks();
  };

  const handleRevoke = async (linkId: string) => {
    setErrorMsg("");
    const { error } = await supabase.rpc("revoke_magic_link", { p_link_id: linkId });
    if (error) {
      setErrorMsg("Could not revoke: " + error.message);
      return;
    }
    loadLinks();
  };

  const handleCopy = async () => {
    if (!newUrl) return;
    try {
      await navigator.clipboard.writeText(newUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg("Copy failed — select and copy the link manually.");
    }
  };

  const statusOf = (l: MagicLink) => {
    if (l.revoked_at) return "Revoked";
    if (new Date(l.expires_at) < new Date()) return "Expired";
    return "Active";
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: 10, padding: 20, maxWidth: 560, width: "100%",
          maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.dark }}>
            &#128279; Family &amp; Student Links {studentName ? `— ${studentName}` : ""}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: COLORS.hint }}
            aria-label="Close"
          >&#10005;</button>
        </div>

        <p style={{ fontSize: 13, color: COLORS.body, marginTop: 0 }}>
          A link gives a read-only view of this student&apos;s progress (a co-teacher / paraprofessional link can optionally allow contributions). Private notes are never shown. Every view is logged. You can revoke a link anytime.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            style={{
              fontSize: 13, padding: "8px 10px", borderRadius: 6, border: "1px solid #d0d0d0",
              background: "white", color: COLORS.dark, fontWeight: 600,
            }}
          >
            {allowedScopes.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {scope === "co_teacher" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.body }}>
              <input
                type="checkbox"
                checked={coteacherWrite}
                onChange={(e) => setCoteacherWrite(e.target.checked)}
              />
              Allow contributions (read &amp; write)
            </label>
          )}

          {scope === "student" && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.body }}>
              <input
                type="checkbox"
                checked={studentSelfAssess}
                onChange={(e) => setStudentSelfAssess(e.target.checked)}
              />
              Allow self-assessment (student rates their own day; your record stays official)
            </label>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !studentId}
            style={{
              background: COLORS.primary, color: "white", border: "none", borderRadius: 6,
              padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: generating ? "default" : "pointer",
            }}
          >
            {generating
              ? "Generating…"
              : `+ Generate ${SCOPE_OPTIONS.find((o) => o.value === scope)?.label.toLowerCase()} link`}
          </button>
        </div>

        {newUrl && (
          <div style={{ background: COLORS.cream, borderRadius: 6, padding: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: COLORS.body, marginBottom: 4 }}>
              New link (copy and share with the parent &mdash; shown once):
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                readOnly
                value={newUrl}
                style={{ flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d0d0" }}
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopy}
                style={{ background: COLORS.dark, color: "white", border: "none", borderRadius: 4, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
              >{copied ? "Copied!" : "Copy"}</button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ color: "#b3261e", fontSize: 13, marginBottom: 10 }}>{errorMsg}</div>
        )}

        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>Existing links</div>
        {loading ? (
          <div style={{ fontSize: 13, color: COLORS.hint }}>Loading…</div>
        ) : links.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.hint }}>No links yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {links.map((l) => {
              const status = statusOf(l);
              return (
                <div key={l.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  border: "1px solid #eee", borderRadius: 6, padding: "8px 10px",
                }}>
                  <div style={{ fontSize: 12, color: COLORS.body }}>
                    <span style={{ fontWeight: 600 }}>
                      {SCOPE_OPTIONS.find((o) => o.value === l.scope_type)?.label ?? l.scope_type}
                    </span>
                    {l.scope_type === "co_teacher" && l.access === "readwrite" ? " (read & write)" : ""}
                    {" · "}{l.use_count} view{l.use_count === 1 ? "" : "s"}
                    {" · "}<span style={{ color: status === "Active" ? COLORS.primary : COLORS.hint }}>{status}</span>
                  </div>
                  {status === "Active" && (
                    <button
                      onClick={() => handleRevoke(l.id)}
                      style={{ background: "none", border: "1px solid #d0d0d0", borderRadius: 4, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: "#b3261e" }}
                    >Revoke</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

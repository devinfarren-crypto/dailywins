"use client";

// The director's link policy: per-type on/off switches for parent, student,
// and co-teacher magic links at this school. The DATABASE enforces the policy
// (generate_magic_link raises when a type is off — migration 047); this card
// is the control surface. Turning a type off does not revoke existing links —
// the list below handles those, and the helper text says so.

import { useEffect, useState } from "react";
import { createClient } from "@/src/lib/supabase";

type LinkSettings = { parent: boolean; student: boolean; co_teacher: boolean };

const TYPES: { key: keyof LinkSettings; label: string; hint: string }[] = [
  { key: "parent", label: "Parent / guardian links", hint: "Read-only progress view for families" },
  { key: "student", label: "Student links", hint: "Student's own view, optional self-assessment" },
  { key: "co_teacher", label: "Co-teacher / paraprofessional links", hint: "Classroom team view, optional contributions" },
];

export default function LinkPolicyCard({ schoolId }: { schoolId: string }) {
  const [settings, setSettings] = useState<LinkSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_school_link_settings", {
        p_school_id: schoolId,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }
      setSettings({
        parent: data?.parent !== false,
        student: data?.student !== false,
        co_teacher: data?.co_teacher !== false,
      });
    })();
  }, [schoolId]);

  async function toggle(key: keyof LinkSettings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSaving(key);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("set_school_link_settings", {
      p_school_id: schoolId,
      p_settings: next,
    });
    setSaving(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSettings({
      parent: data?.parent !== false,
      student: data?.student !== false,
      co_teacher: data?.co_teacher !== false,
    });
  }

  return (
    <div
      style={{
        background: "var(--ssd-surface)",
        border: "1px solid var(--ssd-border)",
        borderRadius: "var(--ssd-radius)",
        padding: "18px 20px",
        marginBottom: 18,
      }}
    >
      <div style={{ fontFamily: "var(--ssd-font-mono), monospace", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ssd-text-muted)", marginBottom: 4 }}>
        Link policy — your school
      </div>
      <div style={{ fontSize: 13, color: "var(--ssd-text-muted)", marginBottom: 14 }}>
        Decide which link types teachers can create. Turning a type off blocks new links
        immediately (enforced at the database); existing links keep working until you revoke
        them in the list below.
      </div>
      {error ? (
        <div style={{ fontSize: 13, color: "var(--ssd-status-support)", marginBottom: 10 }}>{error}</div>
      ) : null}
      {!settings ? (
        <div style={{ fontSize: 13, color: "var(--ssd-text-muted)" }}>Loading policy…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TYPES.map((t) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ssd-ink)" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--ssd-text-muted)" }}>{t.hint}</div>
              </div>
              <button
                onClick={() => toggle(t.key)}
                disabled={saving !== null}
                aria-pressed={settings[t.key]}
                style={{
                  width: 46,
                  height: 26,
                  borderRadius: 999,
                  border: "none",
                  background: settings[t.key] ? "var(--ssd-green)" : "var(--ssd-border)",
                  position: "relative",
                  cursor: saving ? "wait" : "pointer",
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: settings[t.key] ? 23 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                    transition: "left 0.15s ease",
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

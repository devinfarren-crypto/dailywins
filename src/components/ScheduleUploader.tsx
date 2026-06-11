'use client';

import { useState, useCallback } from 'react';
import {
  dbShapeToExtracted,
  type ScheduleType,
  type ExtractedPeriod,
  type ExtractedVariant,
  type ExtractedSchedule,
} from '@/src/lib/schedule-shape';
import type { Schedules } from '@/src/lib/schedules-schema';
import AdminNavyBand from '@/src/components/AdminNavyBand';

// "merge"   → POST adds these variants over the school's existing ones (upload).
// "replace" → POST writes these variants AS the school's whole schedule, so a
//             variant deleted in the editor actually disappears (edit-existing).
type SaveMode = 'merge' | 'replace';

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'extracting'; filename: string }
  | { kind: 'review'; schedule: ExtractedSchedule }
  | { kind: 'saving' }
  | { kind: 'saved'; variants_saved: number; variants_total: number }
  | { kind: 'error'; message: string };

// --- Design tokens (from dailywins design system) ---
const C = {
  primary: '#3a7c6a',
  heading: '#2a4d42',
  cream: '#faf7f0',
  body: '#5a6e66',
  hint: '#8a9690',
  border: '#d8d4c4',
  classBg: '#E1F5EE',
  classBorder: '#0F6E56',
  breakBg: '#F1EFE8',
  breakBorder: '#8A8A85',
  nonStudentBg: '#FAEEDA',
  nonStudentBorder: '#854F0B',
  warning: '#854F0B',
  warningBg: '#FAEEDA',
};

const DAY_LABELS: Record<string, string> = {
  MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun',
};

export interface SchoolOption {
  id: string;
  name: string;
  // The school's current stored schedule (DB JSONB shape), if any. Powers the
  // "Edit current schedule" entry point. Absent/null/empty → upload-only.
  schedules?: Schedules;
}

/** A blank period for the "Add period" affordance. */
function blankPeriod(): ExtractedPeriod {
  return { name: 'New period', start: '08:00', end: '08:50', type: 'class', parent: null, day_notes: null };
}

/** A blank variant for the "Add variant" affordance. */
function blankVariant(): ExtractedVariant {
  return { name: 'New schedule', days: null, specific_dates: null, notes: null, periods: [blankPeriod()] };
}

// The white working card under the shared AdminNavyBand. The band (one slim
// navy row, identical on every admin tab) is the only navy element on the
// page — the old full-bleed "navy stage" made the box jump size and position
// between tabs, so it's gone; states talk through the band's title instead.
function StageCard({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '26px 28px',
        boxShadow: '0 6px 16px rgba(26,38,61,.06)',
        textAlign: center ? 'center' : undefined,
      }}
    >
      {children}
    </div>
  );
}

// Storage keys schedules by variant NAME, so duplicates silently overwrite
// each other — and the model legitimately produces them (e.g. two "ELA
// Testing" windows with different dates). Make names unique as soon as the
// parse arrives, so the director reviews the names that will actually save.
function dedupeVariantNames(schedule: ExtractedSchedule): ExtractedSchedule {
  const next = structuredClone(schedule);
  const used = new Set<string>();
  for (const v of next.variants) {
    const base = v.name.trim() || 'Untitled schedule';
    let name = base;
    if (used.has(name.toLowerCase())) {
      const firstDate = v.specific_dates?.[0];
      if (firstDate && !used.has(`${base} (${firstDate})`.toLowerCase())) {
        name = `${base} (${firstDate})`;
      } else {
        let n = 2;
        while (used.has(`${base} (${n})`.toLowerCase())) n++;
        name = `${base} (${n})`;
      }
    }
    used.add(name.toLowerCase());
    v.name = name;
  }
  return next;
}

export default function ScheduleUploader({
  schools,
}: {
  schools: SchoolOption[];
}) {
  const [state, setState] = useState<UploadState>({ kind: 'idle' });
  const [editedSchedule, setEditedSchedule] = useState<ExtractedSchedule | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(0);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  // One-at-a-time walkthrough of the model's "double-check" notes — a wall of
  // 9 bullets reads as homework; one friendly question at a time reads as a
  // conversation.
  const [checkIdx, setCheckIdx] = useState(0);
  const [checksDone, setChecksDone] = useState(false);
  // Save failures keep the director ON the review screen (their reviewed
  // parse is precious) with this banner, instead of dumping them back to the
  // drop zone — which threw away an 11-check review on 6/11.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    schools[0]?.id ?? ''
  );
  // Which write semantics the next save uses. Upload → "merge"; editing an
  // existing schedule → "replace" so deletes persist. See SaveMode above.
  const [saveMode, setSaveMode] = useState<SaveMode>('merge');

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);
  const existingVariantCount = selectedSchool?.schedules
    ? Object.keys(selectedSchool.schedules).length
    : 0;

  const handleUpload = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setState({ kind: 'error', message: 'Please upload a PDF file.' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      // Vercel rejects request bodies >4.5MB at the edge (an opaque network
      // error, not a nice JSON one) — catch it here with a human message.
      setState({ kind: 'error', message: 'That PDF is over 4 MB. Try exporting just the bell-schedule page(s) — smaller files also read faster.' });
      return;
    }

    setState({ kind: 'uploading', filename: file.name });
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      setState({ kind: 'extracting', filename: file.name });
      // Job + poll: the parse can run 60–120s, and one long-held request dies
      // on VPNs / school proxies (the server finished; the browser saw
      // NetworkError). POST returns a job id immediately; we poll with quick
      // requests until the job lands. Transient poll failures are tolerated.
      const res = await fetch('/api/schedule/parse', { method: 'POST', body: formData });
      const started = await res.json();

      if (!res.ok || !started.job_id) {
        setState({ kind: 'error', message: started.detail || 'Something went wrong starting the upload. Try again.' });
        return;
      }

      const deadline = Date.now() + 6 * 60_000;
      let data: Record<string, unknown> | null = null;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const poll = await fetch(`/api/schedule/parse/status?job=${started.job_id}`, { cache: 'no-store' });
          const body = await poll.json();
          if (body.status === 'done') {
            data = body.result;
            break;
          }
          if (body.status === 'error') {
            if (body.error === 'not_a_bell_schedule') {
              setState({ kind: 'error', message: `This doesn't look like a bell schedule. ${body.detail || ''}` });
            } else if (body.error === 'invalid_json_from_model' || body.error === 'schema_validation_failed') {
              setState({ kind: 'error', message: 'We had trouble reading this PDF. Try a different file, or build the schedule manually.' });
            } else {
              setState({ kind: 'error', message: body.detail || 'Something went wrong. Try again.' });
            }
            return;
          }
          // status 'working' → keep waiting
        } catch {
          // one dropped poll (VPN blip, sleeping laptop) is fine — keep going
        }
      }

      if (!data) {
        setState({ kind: 'error', message: 'This is taking unusually long. Your PDF may still finish — try again in a minute, or build the schedule manually.' });
        return;
      }

      const deduped = dedupeVariantNames(data as unknown as ExtractedSchedule);
      setSaveMode('merge');
      setSaveError(null);
      setCheckIdx(0);
      setChecksDone(false);
      setState({ kind: 'review', schedule: deduped });
      setEditedSchedule(deduped);
      setExpandedVariant(0);
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Upload failed. Try again.',
      });
    }
  }, []);

  // Load the selected school's stored schedule into the review editor. Uses
  // "replace" save semantics so edits and deletions overwrite what's on file.
  const handleEditExisting = useCallback(() => {
    const school = schools.find((s) => s.id === selectedSchoolId);
    if (!school?.schedules || Object.keys(school.schedules).length === 0) {
      setState({ kind: 'error', message: 'This school has no saved schedule to edit yet. Upload a PDF to start.' });
      return;
    }
    const extracted = dbShapeToExtracted(school.schedules, school.name);
    setSaveMode('replace');
    setEditedSchedule(extracted);
    setExpandedVariant(0);
    setShowOnlyFlagged(false);
    setState({ kind: 'review', schedule: extracted });
  }, [schools, selectedSchoolId]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const updatePeriod = (variantIdx: number, periodIdx: number, patch: Partial<ExtractedPeriod>) => {
    if (!editedSchedule) return;
    const next = structuredClone(editedSchedule);
    next.variants[variantIdx].periods[periodIdx] = {
      ...next.variants[variantIdx].periods[periodIdx],
      ...patch,
    };
    setEditedSchedule(next);
  };

  const updateVariant = (variantIdx: number, patch: Partial<ExtractedVariant>) => {
    if (!editedSchedule) return;
    const next = structuredClone(editedSchedule);
    next.variants[variantIdx] = { ...next.variants[variantIdx], ...patch };
    setEditedSchedule(next);
  };

  const removeVariant = (variantIdx: number) => {
    if (!editedSchedule) return;
    if (!confirm(`Remove variant "${editedSchedule.variants[variantIdx].name}"?`)) return;
    const next = structuredClone(editedSchedule);
    next.variants.splice(variantIdx, 1);
    setEditedSchedule(next);
    setExpandedVariant(null);
  };

  const addVariant = () => {
    if (!editedSchedule) return;
    const next = structuredClone(editedSchedule);
    next.variants.push(blankVariant());
    setEditedSchedule(next);
    setExpandedVariant(next.variants.length - 1);
  };

  const addPeriod = (variantIdx: number) => {
    if (!editedSchedule) return;
    const next = structuredClone(editedSchedule);
    next.variants[variantIdx].periods.push(blankPeriod());
    setEditedSchedule(next);
  };

  const removePeriod = (variantIdx: number, periodIdx: number) => {
    if (!editedSchedule) return;
    const variant = editedSchedule.variants[variantIdx];
    // Never drop the last period — a variant with zero periods fails
    // translateVariant() on save. The ✕ is also disabled in this case; this is
    // the belt-and-suspenders guard.
    if (variant.periods.length <= 1) return;
    // Confirm by name. Periods can share a label with their variant (e.g. a
    // "Rally" period inside "Rally Schedule"), which makes a stray click easy —
    // naming the target in the prompt prevents deleting the wrong one.
    const periodName = variant.periods[periodIdx]?.name?.trim() || 'this period';
    if (!confirm(`Remove period "${periodName}"?`)) return;
    const next = structuredClone(editedSchedule);
    next.variants[variantIdx].periods.splice(periodIdx, 1);
    setEditedSchedule(next);
  };

  const handleSave = async () => {
    if (!editedSchedule) return;
    if (!selectedSchoolId) {
      setState({ kind: 'error', message: 'Please select a school to save to.' });
      return;
    }

    // Belt-and-suspenders: the director may have hand-edited names into a
    // collision; fix silently rather than failing the save.
    const cleaned = dedupeVariantNames(editedSchedule);
    setEditedSchedule(cleaned);
    setSaveError(null);
    setState({ kind: 'saving' });
    try {
      const res = await fetch('/api/schedule/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: selectedSchoolId,
          schedule: cleaned,
          mode: saveMode,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'forbidden') {
          setState({
            kind: 'error',
            message: 'You are not an admin of this school.',
          });
        } else if (data.error === 'not_authenticated') {
          setState({
            kind: 'error',
            message: 'Your session expired. Please sign in again.',
          });
        } else {
          // Validation problems are fixable on the review screen — never
          // discard the director's reviewed parse over one.
          setSaveError(data.detail || 'Save failed. Try again.');
          setState({ kind: 'review', schedule: cleaned });
        }
        return;
      }

      setState({
        kind: 'saved',
        variants_saved: data.variants_saved,
        variants_total: data.variants_total,
      });
    } catch (err) {
      // Network hiccup — same rule: keep the review, show the problem.
      setSaveError(err instanceof Error ? err.message : 'Save failed. Try again.');
      setState({ kind: 'review', schedule: cleaned });
    }
  };

  // === RENDER ===

  if (state.kind === 'idle' || state.kind === 'error') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.body }}>
        <AdminNavyBand
          title="Make the day look like your day."
          sub={`${selectedSchool?.name ?? 'Your school'} · drop in a PDF — you'll review everything before it saves.`}
        />
        <StageCard>
        <p style={{ color: C.hint, marginBottom: 20, fontSize: 14.5, lineHeight: 1.55, marginTop: 0 }}>
          The AI reads your bell schedule — every period, variant, and lunch split — and every
          teacher&apos;s grid shows your real day.
        </p>

        {/* School picker — which school you're managing. */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="idle-school-picker" style={{ fontSize: 13, color: C.hint }}>
            School:
          </label>
          {schools.length <= 1 ? (
            <span style={{ fontSize: 14, color: C.heading, fontWeight: 500 }}>
              {selectedSchool?.name ?? 'No schools available'}
            </span>
          ) : (
            <select
              id="idle-school-picker"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '8px 10px', fontSize: 14 }}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Edit-existing entry — only when this school already has a saved schedule. */}
        {existingVariantCount > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              background: '#fff',
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ color: C.heading, fontSize: 15, fontWeight: 500 }}>
                Edit current schedule
              </div>
              <div style={{ color: C.hint, fontSize: 13 }}>
                {existingVariantCount} variant{existingVariantCount === 1 ? '' : 's'} on file · tweak times, add or remove variants
              </div>
            </div>
            <button
              onClick={handleEditExisting}
              style={{
                padding: '8px 16px',
                background: C.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Edit schedule
            </button>
          </div>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: '2px dashed #5DCAA5',
            borderRadius: 14,
            padding: 44,
            textAlign: 'center',
            background: '#E1F5EE',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onClick={() => document.getElementById('pdf-file-input')?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ color: C.heading, fontSize: 16, marginBottom: 6, fontWeight: 500 }}>
            {existingVariantCount > 0 ? 'Or upload a new PDF' : 'Drop your bell schedule PDF here'}
          </div>
          <div style={{ color: C.hint, fontSize: 14 }}>or click to choose a file</div>
          <input
            id="pdf-file-input"
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {state.kind === 'error' && (
          <div
            role="alert"
            style={{
              marginTop: 16,
              padding: 12,
              background: C.warningBg,
              border: `1px solid ${C.warning}`,
              borderRadius: 8,
              color: C.warning,
              fontSize: 14,
            }}
          >
            {state.message}
          </div>
        )}
        </StageCard>
      </div>
    );
  }

  if (state.kind === 'uploading' || state.kind === 'extracting') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <AdminNavyBand
          title={state.kind === 'uploading' ? 'Sending your schedule…' : '🏆 Reading your schedule…'}
          sub={state.filename}
        />
        <StageCard center>
        <style>{`
          @keyframes dwReadBar { 0%, 100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
          @keyframes dwTrophy { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
          .dw-read-bar { transform-box: fill-box; transform-origin: bottom; animation: dwReadBar 1.2s ease-in-out infinite; }
          .dw-trophy { display: inline-block; animation: dwTrophy 1.6s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .dw-read-bar, .dw-trophy { animation: none } }
        `}</style>
        <div style={{ marginBottom: 6 }}>
          <svg width="64" height="64" viewBox="0 0 200 200" aria-hidden="true">
            <rect className="dw-read-bar" style={{ animationDelay: '0s' }} x="38" y="120" width="22" height="40" rx="3" fill="#5DCAA5" />
            <rect className="dw-read-bar" style={{ animationDelay: '.15s' }} x="68" y="98" width="22" height="62" rx="3" fill="#1D9E75" />
            <rect className="dw-read-bar" style={{ animationDelay: '.3s' }} x="98" y="74" width="22" height="86" rx="3" fill="#0F6E56" />
            <rect className="dw-read-bar" style={{ animationDelay: '.45s' }} x="128" y="48" width="22" height="112" rx="3" fill="#1a1a2e" />
            <path d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="158" cy="36" r="8" fill="#EF9F27" />
          </svg>
        </div>
        <div style={{ color: C.heading, fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
          {state.kind === 'uploading' ? 'Uploading' : (
            <><span className="dw-trophy">🏆</span> Reading every period, variant, and lunch split</>
          )}
        </div>
        <div style={{ color: C.hint, fontSize: 14, maxWidth: 380, margin: '0 auto', lineHeight: 1.5 }}>
          {state.kind === 'uploading'
            ? state.filename
            : 'Simple schedules take ~15 seconds; detailed multi-day ones can take a minute or two. This page is not frozen — the bars are working.'}
        </div>
        </StageCard>
      </div>
    );
  }

  if (state.kind === 'saving') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <AdminNavyBand title="Locking it in…" sub="Just a moment." />
        <StageCard center>
          <div style={{ fontSize: 28, marginBottom: 10 }}>💾</div>
          <div style={{ color: C.hint, fontSize: 14 }}>
            Writing your reviewed schedule to {selectedSchool?.name ?? 'your school'}.
          </div>
        </StageCard>
      </div>
    );
  }

  if (state.kind === 'saved') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <AdminNavyBand
          title="🏆 Your schedule is on file."
          sub={`${selectedSchool?.name ?? 'Your school'} · teachers see your real day from their next visit.`}
        />
        <StageCard center>
        <style>{`
          @keyframes dwSavePop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
          @media (prefers-reduced-motion: reduce) { .dw-save-pop { animation: none !important } }
        `}</style>
        <div
          className="dw-save-pop"
          style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
            background: '#1D9E75', color: '#fff', fontSize: 30, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(29,158,117,.22)',
            animation: 'dwSavePop .45s ease both',
          }}
        >
          ✓
        </div>
        <div style={{ color: C.hint, fontSize: 14, marginBottom: 22 }}>
          {state.variants_saved} schedule{state.variants_saved === 1 ? '' : 's'} saved
          {' · '}
          {state.variants_total} total on file.
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/admin/home"
            style={{
              padding: '11px 24px', background: '#0F6E56', color: '#fff', border: 'none',
              borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
            }}
          >
            Back to launch →
          </a>
          <button
            onClick={() => {
              setState({ kind: 'idle' });
              setEditedSchedule(null);
              setExpandedVariant(0);
              setSaveMode('merge');
            }}
            style={{
              padding: '11px 20px', background: 'transparent', color: '#1D9E75',
              border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}
          >
            Upload another
          </button>
        </div>
        </StageCard>
      </div>
    );
  }

  // state.kind === 'review'
  const schedule = editedSchedule!;
  const hasUncertainties = schedule.uncertainties.length > 0;
  const variantsToShow = showOnlyFlagged
    ? schedule.variants.filter((v) =>
        schedule.uncertainties.some((u) => u.toLowerCase().includes(v.name.toLowerCase()))
      )
    : schedule.variants;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.body, maxWidth: 880 }}>
      {/* Header — the same shared band as every other admin surface. */}
      <AdminNavyBand
        title={saveMode === 'replace' ? 'Your schedule, ready to edit' : '🏆 Got it — your schedule is in!'}
        sub={
          <>
            {schedule.school_name && <strong style={{ color: '#5DCAA5' }}>{schedule.school_name}</strong>}
            {schedule.school_year && <> · {schedule.school_year}</>}
            {' · '}
            {schedule.variants.length} schedule{schedule.variants.length === 1 ? '' : 's'} read
            {saveMode === 'replace' ? '.' : (
              <>
                .{' '}
                {schedule.uncertainties.length > 0
                  ? `Now a few quick questions to make it perfect — ${schedule.uncertainties.length} thing${schedule.uncertainties.length === 1 ? '' : 's'} I want your eyes on.`
                  : 'It read clean — skim the list below and save when it looks like your day.'}
              </>
            )}
          </>
        }
      />

      {saveError && (
        <div
          style={{
            background: '#fdf0f0',
            borderLeft: '4px solid #d43c3c',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 20,
            fontSize: 14,
            color: '#9c3a22',
            fontWeight: 600,
          }}
        >
          Couldn&apos;t save: {saveError}. Your review is safe — fix it below (every name and time is editable) and save again.
        </div>
      )}

      {/* Quick checks — one at a time, not a wall */}
      {hasUncertainties && !checksDone && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #d9d4c5',
            borderLeft: '4px solid #EF9F27',
            borderRadius: 12,
            padding: '18px 20px',
            marginBottom: 20,
            boxShadow: '0 6px 16px rgba(26,38,61,.07)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b5740f' }}>
              Quick check {checkIdx + 1} of {schedule.uncertainties.length}
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              {schedule.uncertainties.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: i < checkIdx ? '#1D9E75' : i === checkIdx ? '#EF9F27' : '#ebe7da',
                  }}
                />
              ))}
            </span>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#2a3540', margin: '0 0 16px' }}>
            {schedule.uncertainties[checkIdx]}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (checkIdx >= schedule.uncertainties.length - 1) setChecksDone(true);
                else setCheckIdx(checkIdx + 1);
              }}
              style={{
                background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 999,
                padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {checkIdx >= schedule.uncertainties.length - 1 ? 'All checked — looks right ✓' : 'Looks right — next ›'}
            </button>
            {checkIdx > 0 && (
              <button
                onClick={() => setCheckIdx(checkIdx - 1)}
                style={{ background: 'none', border: 'none', color: '#7a7a8e', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                ‹ Back
              </button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7a7a8e', cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={showOnlyFlagged}
                onChange={(e) => setShowOnlyFlagged(e.target.checked)}
              />
              Show only flagged schedules
            </label>
          </div>
          <p style={{ fontSize: 12, color: '#7a7a8e', margin: '12px 0 0' }}>
            Anything off? Edit it directly in the schedule list below — these checks are just pointers.
          </p>
        </div>
      )}
      {hasUncertainties && checksDone && (
        <div
          style={{
            background: '#E1F5EE',
            borderLeft: '4px solid #1D9E75',
            borderRadius: 12,
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: '#0F6E56' }}>
            ✓ All {schedule.uncertainties.length} checks reviewed — save when the list below looks like your day.
          </span>
          <button
            onClick={() => { setChecksDone(false); setCheckIdx(0); }}
            style={{ background: 'none', border: 'none', color: '#1D9E75', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            Review again
          </button>
        </div>
      )}

      {/* Variant list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {variantsToShow.map((variant) => {
          const idx = schedule.variants.indexOf(variant);
          const isExpanded = expandedVariant === idx;
          const isFlagged = schedule.uncertainties.some((u) =>
            u.toLowerCase().includes(variant.name.toLowerCase())
          );

          return (
            <div
              key={idx}
              style={{
                border: `1px solid ${isFlagged ? C.warning : C.border}`,
                borderRadius: 8,
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              {/* Variant header — click to expand */}
              <button
                onClick={() => setExpandedVariant(isExpanded ? null : idx)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  background: isExpanded ? C.cream : '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: C.hint }}>{isExpanded ? '▼' : '▶'}</span>
                  <span style={{ color: C.heading, fontWeight: 500, fontSize: 15 }}>
                    {variant.name}
                  </span>
                  {isFlagged && (
                    <span
                      style={{
                        fontSize: 11,
                        color: C.warning,
                        background: C.warningBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 500,
                      }}
                    >
                      needs review
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.hint, whiteSpace: 'nowrap' }}>
                  {variant.periods.length} periods
                  {variant.days && variant.days.length > 0 && (
                    <> · {variant.days.map((d) => DAY_LABELS[d] || d).join(', ')}</>
                  )}
                  {variant.specific_dates && variant.specific_dates.length > 0 && (
                    <> · {variant.specific_dates.length} date{variant.specific_dates.length === 1 ? '' : 's'}</>
                  )}
                </div>
              </button>

              {/* Expanded edit view */}
              {isExpanded && (
                <div style={{ padding: 16, borderTop: `1px solid ${C.border}` }}>
                  {/* Variant name editor */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: C.hint, display: 'block', marginBottom: 4 }}>
                      Name
                    </label>
                    <input
                      type="text"
                      value={variant.name}
                      onChange={(e) => updateVariant(idx, { name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  {/* Days picker */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: C.hint, display: 'block', marginBottom: 4 }}>
                      Recurring days of the week
                    </label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {['MON', 'TUE', 'WED', 'THU', 'FRI'].map((day) => {
                        const selected = variant.days?.includes(day) ?? false;
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const current = variant.days || [];
                              const next = selected
                                ? current.filter((d) => d !== day)
                                : [...current, day];
                              updateVariant(idx, { days: next.length ? next : null });
                            }}
                            style={{
                              padding: '6px 12px',
                              border: `1px solid ${selected ? C.classBorder : C.border}`,
                              background: selected ? C.classBg : '#fff',
                              color: selected ? C.classBorder : C.body,
                              borderRadius: 6,
                              fontSize: 13,
                              cursor: 'pointer',
                              fontWeight: selected ? 500 : 400,
                            }}
                          >
                            {DAY_LABELS[day]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Specific dates */}
                  {variant.specific_dates && variant.specific_dates.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, color: C.hint, display: 'block', marginBottom: 4 }}>
                        Specific dates
                      </label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {variant.specific_dates.map((d, i) => (
                          <span
                            key={i}
                            style={{
                              padding: '4px 8px',
                              background: C.cream,
                              border: `1px solid ${C.border}`,
                              borderRadius: 4,
                              fontSize: 12,
                              color: C.body,
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {variant.notes && (
                    <div style={{ marginBottom: 16, padding: 8, background: C.cream, borderRadius: 4, fontSize: 12, color: C.hint, fontStyle: 'italic' }}>
                      From the PDF: {variant.notes}
                    </div>
                  )}

                  {/* Periods table */}
                  <div style={{ fontSize: 12, color: C.hint, marginBottom: 6 }}>
                    Periods
                  </div>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                    {variant.periods.map((period, pIdx) => {
                      const bg =
                        period.type === 'class' ? C.classBg :
                        period.type === 'break' ? C.breakBg : C.nonStudentBg;
                      const borderColor =
                        period.type === 'class' ? C.classBorder :
                        period.type === 'break' ? C.breakBorder : C.nonStudentBorder;
                      return (
                        <div
                          key={pIdx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 80px 110px 28px',
                            gap: 8,
                            padding: 8,
                            background: bg,
                            borderBottom: pIdx === variant.periods.length - 1 ? 'none' : `1px solid ${C.border}`,
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <input
                              type="text"
                              value={period.name}
                              onChange={(e) => updatePeriod(idx, pIdx, { name: e.target.value })}
                              style={{ ...inputStyle, padding: '4px 6px', fontSize: 13 }}
                            />
                            {period.parent && (
                              <div style={{ fontSize: 11, color: C.hint, marginTop: 2 }}>
                                sub-block of {period.parent}
                              </div>
                            )}
                            {period.day_notes && (
                              <div style={{ fontSize: 11, color: C.warning, marginTop: 2 }}>
                                day notes: {period.day_notes}
                              </div>
                            )}
                          </div>
                          <input
                            type="time"
                            value={period.start}
                            onChange={(e) => updatePeriod(idx, pIdx, { start: e.target.value })}
                            style={{ ...inputStyle, padding: '4px 6px', fontSize: 13 }}
                          />
                          <input
                            type="time"
                            value={period.end}
                            onChange={(e) => updatePeriod(idx, pIdx, { end: e.target.value })}
                            style={{ ...inputStyle, padding: '4px 6px', fontSize: 13 }}
                          />
                          <select
                            value={period.type}
                            onChange={(e) => updatePeriod(idx, pIdx, { type: e.target.value as ScheduleType })}
                            style={{
                              ...inputStyle,
                              padding: '4px 6px',
                              fontSize: 12,
                              borderColor,
                              color: borderColor,
                              fontWeight: 500,
                            }}
                          >
                            <option value="class">scored</option>
                            <option value="break">break</option>
                            <option value="non_student">not for students</option>
                          </select>
                          <button
                            onClick={() => removePeriod(idx, pIdx)}
                            title="Remove this period"
                            aria-label={`Remove period ${period.name}`}
                            disabled={variant.periods.length === 1}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: variant.periods.length === 1 ? C.border : C.hint,
                              fontSize: 16,
                              lineHeight: 1,
                              cursor: variant.periods.length === 1 ? 'not-allowed' : 'pointer',
                              padding: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add period */}
                  <button
                    onClick={() => addPeriod(idx)}
                    style={{
                      marginTop: 8,
                      padding: '6px 10px',
                      background: 'transparent',
                      color: C.primary,
                      border: `1px dashed ${C.primary}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    + Add period
                  </button>

                  {/* Remove variant */}
                  <button
                    onClick={() => removeVariant(idx)}
                    style={{
                      marginTop: 12,
                      padding: '6px 10px',
                      background: 'transparent',
                      color: C.hint,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Remove this variant
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add variant — hidden while the flagged-only filter is on (it would
            be confusing to add into a filtered list). */}
        {!showOnlyFlagged && (
          <button
            onClick={addVariant}
            style={{
              padding: '12px 16px',
              background: 'transparent',
              color: C.primary,
              border: `1px dashed ${C.primary}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            + Add a schedule variant
          </button>
        )}
      </div>

      {/* Save bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="school-picker" style={{ fontSize: 13, color: C.hint }}>
            Save to:
          </label>
          {saveMode === 'replace' ? (
            // Editing a specific school's existing schedule — lock the target so
            // a "replace" can't accidentally overwrite a different school.
            <span style={{ fontSize: 14, color: C.heading, fontWeight: 500 }}>
              {selectedSchool?.name ?? '—'}
            </span>
          ) : (
            <select
              id="school-picker"
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              style={{
                ...inputStyle,
                width: 'auto',
                padding: '8px 10px',
                fontSize: 14,
              }}
            >
              {schools.length === 0 && (
                <option value="">No schools available</option>
              )}
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              setState({ kind: 'idle' });
              setEditedSchedule(null);
              setSaveMode('merge');
            }}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              color: C.body,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Start over
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedSchoolId}
            style={{
              padding: '10px 20px',
              background: selectedSchoolId ? C.primary : C.border,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: selectedSchoolId ? 'pointer' : 'not-allowed',
            }}
          >
            {saveMode === 'replace' ? 'Save changes' : 'Save schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 14,
  border: `1px solid ${C.border}`,
  borderRadius: 4,
  background: '#fff',
  color: C.body,
  fontFamily: 'inherit',
};

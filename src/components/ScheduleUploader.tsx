'use client';

import { useState, useCallback } from 'react';

// Types mirror the API route. In your real codebase, import from a shared types file.
type ScheduleType = 'class' | 'break' | 'non_student';

interface ExtractedPeriod {
  name: string;
  start: string;
  end: string;
  type: ScheduleType;
  parent: string | null;
  day_notes: string | null;
}

interface ExtractedVariant {
  name: string;
  days: string[] | null;
  specific_dates: string[] | null;
  notes: string | null;
  periods: ExtractedPeriod[];
}

interface ExtractedSchedule {
  school_name: string | null;
  school_year: string | null;
  variants: ExtractedVariant[];
  uncertainties: string[];
}

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'extracting'; filename: string }
  | { kind: 'review'; schedule: ExtractedSchedule }
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

export default function ScheduleUploader({
  onSave,
}: {
  onSave?: (schedule: ExtractedSchedule) => Promise<void> | void;
}) {
  const [state, setState] = useState<UploadState>({ kind: 'idle' });
  const [editedSchedule, setEditedSchedule] = useState<ExtractedSchedule | null>(null);
  const [expandedVariant, setExpandedVariant] = useState<number | null>(0);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setState({ kind: 'error', message: 'Please upload a PDF file.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setState({ kind: 'error', message: 'File too large. Max 10 MB.' });
      return;
    }

    setState({ kind: 'uploading', filename: file.name });
    const formData = new FormData();
    formData.append('pdf', file);

    try {
      setState({ kind: 'extracting', filename: file.name });
      const res = await fetch('/api/schedule/parse', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'not_a_bell_schedule') {
          setState({
            kind: 'error',
            message: `This doesn't look like a bell schedule. ${data.detail || ''}`,
          });
        } else if (data.error === 'invalid_json_from_model' || data.error === 'schema_validation_failed') {
          setState({
            kind: 'error',
            message: 'We had trouble reading this PDF. Try a different file, or build the schedule manually.',
          });
        } else {
          setState({ kind: 'error', message: data.detail || 'Something went wrong. Try again.' });
        }
        return;
      }

      setState({ kind: 'review', schedule: data });
      setEditedSchedule(data);
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Upload failed. Try again.',
      });
    }
  }, []);

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

  const handleSave = async () => {
    if (!editedSchedule || !onSave) return;
    await onSave(editedSchedule);
  };

  // === RENDER ===

  if (state.kind === 'idle' || state.kind === 'error') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.body }}>
        <h2 style={{ color: C.heading, fontSize: 24, fontWeight: 500, marginBottom: 8 }}>
          Upload your bell schedule
        </h2>
        <p style={{ color: C.hint, marginBottom: 24, fontSize: 15 }}>
          Drop your school's bell schedule PDF and we'll read it for you. You'll get a chance to
          review and fix anything before it's saved.
        </p>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: `2px dashed ${C.border}`,
            borderRadius: 12,
            padding: 48,
            textAlign: 'center',
            background: C.cream,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onClick={() => document.getElementById('pdf-file-input')?.click()}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📄</div>
          <div style={{ color: C.heading, fontSize: 16, marginBottom: 6, fontWeight: 500 }}>
            Drop your bell schedule PDF here
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
      </div>
    );
  }

  if (state.kind === 'uploading' || state.kind === 'extracting') {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 28, marginBottom: 16 }}>⏳</div>
        <div style={{ color: C.heading, fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
          {state.kind === 'uploading' ? 'Uploading' : 'Reading your schedule'}
        </div>
        <div style={{ color: C.hint, fontSize: 14 }}>
          {state.kind === 'uploading'
            ? state.filename
            : 'This usually takes about 10 seconds. Hang tight.'}
        </div>
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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: C.heading, fontSize: 24, fontWeight: 500, marginBottom: 4 }}>
          Review your schedule
        </h2>
        <p style={{ color: C.hint, fontSize: 14, margin: 0 }}>
          {schedule.school_name && <>{schedule.school_name} · </>}
          {schedule.school_year && <>{schedule.school_year} · </>}
          {schedule.variants.length} variant{schedule.variants.length === 1 ? '' : 's'} found
        </p>
      </div>

      {/* Uncertainties summary */}
      {hasUncertainties && (
        <div
          style={{
            background: C.warningBg,
            border: `1px solid ${C.warning}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ color: C.warning, fontWeight: 500, marginBottom: 8, fontSize: 15 }}>
            {schedule.uncertainties.length} thing{schedule.uncertainties.length === 1 ? '' : 's'} to double-check
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, color: C.warning, fontSize: 13, lineHeight: 1.6 }}>
            {schedule.uncertainties.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 13, color: C.warning, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOnlyFlagged}
              onChange={(e) => setShowOnlyFlagged(e.target.checked)}
            />
            Show only flagged variants
          </label>
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
                            gridTemplateColumns: '1fr 80px 80px 110px',
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
                        </div>
                      );
                    })}
                  </div>

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
      </div>

      {/* Save bar */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'flex-end',
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <button
          onClick={() => {
            setState({ kind: 'idle' });
            setEditedSchedule(null);
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
          style={{
            padding: '10px 20px',
            background: C.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Save schedule
        </button>
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

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/src/lib/supabase-server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const MODEL = 'claude-sonnet-4-5'; // swap to claude-haiku-4-5 for cost

const SYSTEM_PROMPT = `You are a precise data extractor for school bell schedules. Your only job is to read a bell schedule PDF and return its contents as structured JSON.

A "bell schedule" is a document that lists the daily class period structure at a school — period names, start times, end times, and which days of the week or specific dates each schedule variant applies to.

A school typically has multiple SCHEDULE VARIANTS in one PDF, for example:
- Regular schedule (most common days)
- Minimum day / early-out
- Late start / collaboration day
- Rally schedule
- Finals schedule (often different days have different finals layouts)
- Assembly schedule
- One-off event schedules (first day, graduation, testing days, etc.)

Each variant has its own set of PERIODS. A period has:
- A name (e.g., "Period 1", "Homeroom", "Advisory", "Trail Time", "Lunch 1", "Lunch 2", "Passing")
- A start time
- An end time
- A type: "class" (a scoring period a teacher tracks behavior in), "break" (lunch, passing, nutrition), or "non_student" (staff-only blocks like "Staff Work", "Prof Learning for Staff", or senior-only blocks like "Srs Only" or "Srs - Grad" — students in the general population aren't present)

Times should always be in 24-hour HH:MM format (e.g., "08:15", "14:30"). Convert 12-hour times by inferring AM/PM from context — school days start in the morning and end in the afternoon.

CRITICAL SCHEMA NOTES — read carefully:

SPLIT LUNCHES: Many secondary schedules have overlapping periods because of split lunches (Lunch 1 and Lunch 2 running concurrently with parts of Period 3 and Period 4). Extract all periods as listed, even when they overlap in time. If you detect overlap, include a note in "uncertainties" describing which periods overlap so the human reviewer is aware. Do not try to resolve the overlap — preserve the schedule as printed.

DAY-OF-WEEK MAPPINGS INSIDE PERIODS: Some periods (like "Trail Time" or "Advisory") have day-specific behavior printed inside their row (e.g., "Mon – Per. 1 / Tues – Per. 2 / Wed – Per. 3/4 / Fri – Per. 5"). When you see this, capture it in the period's "day_notes" field as the literal text from the PDF. Do not try to interpret it — just preserve it.

NESTED SUB-PERIODS: Some schedules have sub-blocks inside a larger period (e.g., "Assembly A" and "Assembly B" nested inside "Period 1"). Represent these as separate periods at the same level, but include each one with its parent period name in the "parent" field. Sub-blocks usually have type "break" since they're not regular class instruction.

ONE-OFF DATE VARIANTS: If a variant applies to a specific date or list of dates rather than a recurring day of the week (e.g., "First Day Kickoff — Thurs. Aug 14"), populate "specific_dates" with those dates as ISO strings (YYYY-MM-DD), and set "days" to null. If a variant applies to a recurring weekday with no specific date constraint (e.g., "Late Start Thursday" with no date list), populate "days" with the weekday(s) and leave "specific_dates" null.

YEAR INFERENCE FOR DATES: When extracting specific_dates, infer the calendar year from the school year stated in the PDF header. Months August through December → first year of the school year (e.g., "Aug 14" in "2025-2026" → "2025-08-14"). Months January through July → second year (e.g., "March 12" in "2025-2026" → "2026-03-12"). If no school year is stated in the PDF, set "school_year" to null and add an uncertainty noting that years were inferred from context.

VARIANTS WITH MULTIPLE LAYOUTS: If one heading groups multiple distinct layouts (e.g., "Finals" with one layout for Thursday and a different one for Friday), split them into two separate variants with descriptive names like "Finals (Thursday)" and "Finals (Friday)".

DUPLICATES: If the same variant appears more than once in the PDF, include it only once and add a note in "uncertainties" stating that it was found N times in the source.

EXCLUDE STAFF-ONLY BLOCKS FROM SCORING: Any block clearly labeled as staff-only or senior-only (e.g., "Staff Work", "Prof Learning for Staff", "Srs Only", "Srs - Grad") should still appear in the periods array with type "non_student", so the teacher knows the block exists but the app will skip it for scoring.

RULES:
1. Return ONLY a single JSON object. No prose, no markdown fences, no commentary.
2. If the PDF is not a bell schedule, return: {"error": "not_a_bell_schedule", "detail": "<one sentence describing what the PDF appears to be>"}
3. For each schedule variant, include all its periods in order from earliest start time to latest start time.
4. Use the EXACT period and variant names from the PDF. Preserve spelling, capitalization, en-dashes, and ampersands.
5. If any time is unclear, smudged, or inconsistent (e.g., end time before start time, or overlapping periods that don't make sense as split lunches), include a description in "uncertainties".
6. Do not invent variants, periods, or details that aren't in the PDF.

OUTPUT SCHEMA (return exactly this shape, no extra fields):
{
  "school_name": "<string or null>",
  "school_year": "<string or null, e.g., '2025-2026'>",
  "variants": [
    {
      "name": "<variant name as printed>",
      "days": ["MON", "TUE", "WED", "THU", "FRI"] or null,
      "specific_dates": ["YYYY-MM-DD"] or null,
      "notes": "<free-text footnote from the PDF for this variant, or null>",
      "periods": [
        {
          "name": "<period name as printed>",
          "start": "HH:MM",
          "end": "HH:MM",
          "type": "class" | "break" | "non_student",
          "parent": "<parent period name if this is a sub-block, else null>",
          "day_notes": "<literal text of day-mapping notes inside this period row, or null>"
        }
      ]
    }
  ],
  "uncertainties": [
    "<plain-English description of anything a human should double-check>"
  ]
}`;

// --- Types mirror the schema above ---

export type ScheduleType = 'class' | 'break' | 'non_student';

export interface ExtractedPeriod {
  name: string;
  start: string;
  end: string;
  type: ScheduleType;
  parent: string | null;
  day_notes: string | null;
}

export interface ExtractedVariant {
  name: string;
  days: string[] | null;
  specific_dates: string[] | null;
  notes: string | null;
  periods: ExtractedPeriod[];
}

export interface ExtractedSchedule {
  school_name: string | null;
  school_year: string | null;
  variants: ExtractedVariant[];
  uncertainties: string[];
}

export interface ExtractionError {
  error: string;
  detail?: string;
  raw?: string;
}

// --- Helpers ---

function stripCodeFences(text: string): string {
  let trimmed = text.trim();
  trimmed = trimmed.replace(/^```(?:json)?\s*\n?/i, '');
  trimmed = trimmed.replace(/\n?\s*```\s*$/i, '');
  return trimmed.trim();
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}
function isStringArrayOrNull(v: unknown): v is string[] | null {
  return v === null || (Array.isArray(v) && v.every(isString));
}

function validateSchedule(data: unknown): data is ExtractedSchedule {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!isStringOrNull(d.school_name)) return false;
  if (!isStringOrNull(d.school_year)) return false;
  if (!Array.isArray(d.variants)) return false;
  if (!Array.isArray(d.uncertainties) || !d.uncertainties.every(isString)) return false;

  for (const v of d.variants) {
    if (!v || typeof v !== 'object') return false;
    const variant = v as Record<string, unknown>;
    if (!isString(variant.name)) return false;
    if (!isStringArrayOrNull(variant.days)) return false;
    if (!isStringArrayOrNull(variant.specific_dates)) return false;
    if (!isStringOrNull(variant.notes)) return false;
    if (!Array.isArray(variant.periods)) return false;
    for (const p of variant.periods) {
      if (!p || typeof p !== 'object') return false;
      const period = p as Record<string, unknown>;
      if (!isString(period.name)) return false;
      if (!isString(period.start)) return false;
      if (!isString(period.end)) return false;
      if (!['class', 'break', 'non_student'].includes(period.type as string)) return false;
      if (!isStringOrNull(period.parent)) return false;
      if (!isStringOrNull(period.day_notes)) return false;
    }
  }
  return true;
}

// --- Route ---

export async function POST(req: NextRequest) {
  try {
    // Auth check — only logged-in users can call this endpoint.
    // Protects the Anthropic API key from random visitors burning credits.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json<ExtractionError>(
        { error: 'not_authenticated', detail: 'You must be signed in to upload a schedule.' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;

    if (!file) {
      return NextResponse.json<ExtractionError>({ error: 'no_file' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json<ExtractionError>({ error: 'not_a_pdf' }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json<ExtractionError>(
        { error: 'file_too_large', detail: 'Max 10 MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    console.log('\n=== [schedule/parse] sending PDF to Claude ===');
    console.log(`  file: ${file.name}, size: ${file.size} bytes, user: ${user.email ?? user.id}`);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract the bell schedule(s) from this PDF and return JSON per the schema.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      console.log('=== [schedule/parse] no text block in response ===');
      console.log(JSON.stringify(response.content, null, 2));
      return NextResponse.json<ExtractionError>(
        { error: 'no_response_text' },
        { status: 500 }
      );
    }

    const rawText = textBlock.text;
    console.log('\n=== [schedule/parse] raw response from Claude ===');
    console.log(rawText.slice(0, 2000));
    if (rawText.length > 2000) console.log(`... [truncated, total ${rawText.length} chars]`);
    console.log('=== end raw response ===\n');

    const cleaned = stripCodeFences(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.log('=== [schedule/parse] JSON.parse failed ===');
      console.log(parseErr);
      return NextResponse.json<ExtractionError>(
        {
          error: 'invalid_json_from_model',
          detail: parseErr instanceof Error ? parseErr.message : 'parse error',
          raw: rawText.slice(0, 500),
        },
        { status: 500 }
      );
    }

    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      console.log('=== [schedule/parse] model returned error ===');
      console.log(parsed);
      return NextResponse.json(parsed, { status: 422 });
    }

    if (!validateSchedule(parsed)) {
      console.log('=== [schedule/parse] schema validation failed ===');
      console.log('Parsed keys:', Object.keys(parsed as object));
      console.log('Full parsed:', JSON.stringify(parsed, null, 2).slice(0, 2000));
      return NextResponse.json<ExtractionError>(
        {
          error: 'schema_validation_failed',
          detail: 'Model returned JSON but it did not match the expected schema',
          raw: rawText.slice(0, 500),
        },
        { status: 500 }
      );
    }

    console.log(`=== [schedule/parse] success: ${(parsed as ExtractedSchedule).variants.length} variants extracted ===`);
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    console.error('=== [schedule/parse] top-level error ===');
    console.error(err);
    return NextResponse.json<ExtractionError>(
      { error: 'server_error', detail: message },
      { status: 500 }
    );
  }
}

// Complex multi-variant bell schedules can take the model >60s; Fluid compute
// allows up to 300s and the uploader UI sets expectations + animates while
// waiting. (A 60s cap was killing real uploads mid-parse → browser saw a
// bare NetworkError. Vercel log 2026-06-11 19:53: 504 Runtime Timeout.)
export const maxDuration = 300;

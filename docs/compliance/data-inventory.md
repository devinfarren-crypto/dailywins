# DailyWins — Student Data Inventory

*Vendor packet, drafted 2026-06-11. Pairs with NDPA Exhibit B (see
exhibit-b-worksheet.md). Owner: Sure Step Education.*

## What DailyWins collects about students

| Data element | Collected | Notes |
|---|---|---|
| Student name | **Yes — display name only** | Teacher-entered roster name (often first name + last initial). First/last name fields exist but the product runs on `display_name`. |
| Behavior observations | **Yes** | Per-period binary/scaled marks across 5 teacher-configurable categories (e.g. Arrival, Compliance, Social, On-Task, Phone Away). |
| Teacher notes | **Yes** | Free-text observations, flagged shared (parent-visible) or private (staff/record only). |
| Student self-assessments | **Yes (optional)** | Only when a teacher enables a read-write student link; stored separately from the official record. |
| Date of birth | No | |
| Student ID / SSID | No (planned optional field for placement reporting; district-controlled) | |
| Address, phone, email | No | Students have no accounts and no email. |
| Grades / transcripts / assessments | No | |
| Attendance | Partial | Per-period absent markers (excused/unexcused) used for scoring context; not an attendance system of record. |
| Health / IEP documents | No | Teachers may reference goals in notes; DailyWins stores no IEP documents. |
| Photos / biometric | No | |
| Geolocation | No | |
| Device identifiers / advertising IDs | No | No analytics SDKs, no ad tech, no third-party trackers. |

## What DailyWins collects about staff

Name, school email, school assignment, sign-in timestamps, and an audit trail
of administrative actions. Staff authenticate via Google SSO or email
magic-link; no passwords are stored.

## Where data lives

Single-region Postgres (Supabase, AWS **us-east-1**). Encrypted at rest and in
transit (TLS 1.2+). No student data leaves this store except: (a) transactional
email to *staff* (never student data in email bodies), and (b) reports/PDFs
generated on demand by authorized users in the browser.

## Who can see what (enforced in the database, not just the UI)

- **Teacher** → only their own students.
- **Parent/student/co-teacher links** → single-student, read-scoped, revocable,
  expiring tokens; private notes never appear on parent/student links.
- **NPS school director** → full records at their school; every record open
  and every PDF export writes an audit entry.
- **District administrator** → aggregate counts; individual records and names
  are blocked by row-level security ("PII-blind by database design").
- **Operator (Sure Step Education)** → PII-blind in normal operation;
  maintenance access is break-glass, reason-required, and audited.

## Use limitations (SOPIPA posture)

No advertising, no marketing to students or families, no profiling for
non-educational purposes, no sale or rental of data, ever. AI is used solely
to parse school bell-schedule PDFs (documents containing no student data) and
is contractually excluded from model training (see subprocessors.md).

## Retention & deletion

Records persist for the customer's contract term. Student removal from a
roster is a soft archive — the record is retained (it is the school's legal
record), never silently destroyed. On contract termination: full export
provided on request, then deletion within 60 days of written request,
certified in writing. De-identified data is not retained.

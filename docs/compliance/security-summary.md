# DailyWins — Security Program Summary

*Vendor packet, drafted 2026-06-11. The one-pager a district security
reviewer reads before the questionnaire.*

## Architecture in one paragraph

DailyWins is a single-tenant-region web application (Next.js on Vercel,
Postgres on Supabase/AWS us-east-1). Every access rule is enforced **in the
database** with row-level security — not just hidden in the UI — so a
misbehaving client cannot widen its own access. Privileged service-role access
exists only in server code and is never shipped to browsers.

## Access control

- **Role tiers:** teacher → own students only; school director (non-public
  schools) → own school, fully audited; district administrator → aggregates
  only, individual student data blocked by RLS ("PII-blind by database
  design"); operator → PII-blind with break-glass exception (below).
- **Authentication:** staff sign in via Google SSO or single-use, 24-hour
  email links (no passwords to phish or leak). Students have no accounts.
  Access is approval-gated: authenticating does not grant access until a
  human approves the request.
- **Family access:** scoped, revocable, expiring tokens per student; the
  school controls which link types may exist at all, enforced in the database.

## Audit trail

Append-only audit log (no update/delete path) covering: administrative and
configuration changes (with before/after diffs), every director record open,
every record PDF export (stamped with the exporting user), impersonation
("act-as") sessions, and break-glass events. Directors see their school's
trail in-product.

## Operator access ("vendor can't read your data")

Sure Step Education staff cannot read student records in normal operation —
the same RLS that binds district admins binds us. Maintenance access requires
an explicit **break-glass** action: founder-only, reason required, 15-minute
timeout, prominently logged. Support impersonation ("act-as") is audited with
a visible banner and inactivity expiry.

## Data protection

- Encryption in transit (TLS 1.2+) and at rest (AES-256, managed by AWS).
- Records are soft-deleted (archived) — roster changes can never silently
  destroy a student's record; restoration is controlled.
- Schema changes ship as versioned, numbered migrations; production changes
  are snapshot-first.
- Backups: provider-managed daily backups with point-in-time recovery.

## Development practices

TypeScript strict mode; schema-validated inputs (Zod) on API routes; secrets
in platform environment configuration (never in source); least-privilege keys
(the browser only ever holds anonymous, RLS-bound credentials); dependency
updates tracked; independent code review of security-relevant changes.

## Incident response

See breach-notification.md: 72-hour LEA notice, cooperation with district
obligations under Ed. Code §49073.1 and Civ. Code §1798.29.

## Honest scope notes

DailyWins is an early-stage product from a small company. We do not yet hold
a SOC 2 report of our own (our infrastructure providers do — see
subprocessors.md); penetration testing is on the roadmap and we welcome a
district-led security review. What we lack in certifications we make up for
in surface area: no ads, no trackers, no mobile SDKs, one database, one
region, and a product small enough to audit in an afternoon.

# DailyWins Roadmap

Last updated: May 28, 2026 (EOD)

Beta access is live and approve-gated. Three pilot teachers in production, self-serve onboarding working end-to-end. Next major beat is the EGUSD meeting on July 13.

## Shipped since 5/7
- **Beta access layer (data):** `access_requests` table + RLS, `approve_access_request` RPC (atomic provisioning), `ensure_teacher_exists` hardened to refuse un-approved users. Migrations 022–025.
- **Beta access layer (app):** `/pending` page for queued users, sign-in-first auth callback, founder `/admin/requests` queue with Approve/Deny + school picker (existing or create-new), Resend email notification dormant until env vars set.
- **Bugs fixed:** Period-0 save (025 widened check), L/E arrival ambiguity (store option index instead of point value), arrival bulk-fill + mobile-render follow-up, legacy `arrival = 3` data cleanup (live SQL, not yet a migration file).
- **Sign-in UX:** Google `prompt=select_account` so multi-account users get the picker every time.
- **Infra:** Empty duplicate Supabase project paused. UNIQUE constraint on `access_requests.user_id` (migration 026) so onConflict upserts actually work.

## Open — sorted by what blocks tester growth
- **Resend setup** (only Devin can do): sign up, verify `dailywins.school` DNS, set `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` + `NOTIFY_TO_EMAIL` in Vercel. Email code is already shipped and dormant.
- **Demo Mode cosmetic bugs:** Phone Out of Sight / On Task showing zero in demo seed data only — surfaces every time you demo to a colleague.
- **`teachers.preferences` drift:** column exists on staging, not prod. Footgun. Decide: add to prod, or drop from staging.
- **Capture live-only fixes as migration files:** legacy arrival cleanup, May 27 staging roles RLS fix.
- **`allowed_emails` is vestigial** since the auth callback rewrite stopped reading it. Drop after a quiet observation period.
- **Supabase migrations tracking drift:** prod's `schema_migrations` table only shows 11 entries; local has 26 files. Reconcile if it matters.

## After June 8 — bigger pieces
- **`school_schedules` table** (move bell schedules out of hardcoded TypeScript). Cost: ~10h. Trigger has fired faster than expected — the admin UI now onboards a third school instantly, and EGUSD prep needs this story straight. Likely promote to "before July 13."
- **Phase 4 audit log** — not started. Required for compliance story.
- **Phase 5 act-as ("secret weapon" for the EGUSD demo)** — not started. Highest-leverage thing for July 13.
- **Phase 6 Site Admin schedule editor** — not started; sequenced after `school_schedules`.

## EGUSD July 13 prep
- **Compliance folder:** privacy / DPA / RLS / audit story. Partial. Needs refresh to reflect that approve-gated onboarding + RLS-enforced data isolation are now real, not hypothetical.
- **Story / demo script:** not addressed. Should center on beta access feature as proof of "approve-gated onboarding, RLS-enforced data isolation, no PII leakage between schools."
- **Mock meeting with Nick:** not scheduled.
- **Act-as feature** is the demo's wow moment. If only one phase ships before 7/13, it's this.

## Pilot status (snapshot 5/28/2026)
- Devin (founder + teacher) — PGHS
- Tommy (teacher) — PGHS
- Nick (teacher) — COHS
- First throwaway beta tester approved today via the new admin UI: `iwhowanders@gmail.com` → Sacramento High School
- Allowlist is vestigial; approval is now the gate

## Tracked cautions
- Read prod / write staging / propose prod writes. No autonomous prod schema or data writes by any Claude instance.
- Stage-test, **then** commit migrations — not the reverse.
- A passing type-check is not a working feature. Verify in the browser before reporting done.
- `onConflict` upserts require a real UNIQUE constraint. Verify before trusting.
- `auth.uid()` requires the cookies session client, not service-role. Service-role for RLS-blocked reads/writes; cookies session for anything that audits or self-authorizes.

## Infrastructure
- **Prod:** Supabase `kvbpfvazddlmoxobqfev` (us-east-1). Vercel one project, three domains.
- **Staging:** Supabase `oqhhpdaijscqdkpsxowq` (us-east-2) — paused 5/28. Restore before any staging-first work, or move to Supabase branches.
- **Git:** `main` is the only active branch. Latest commit on push: `b5dd489` (email notification).
